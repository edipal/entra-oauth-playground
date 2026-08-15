import { expect, test, type Page } from "@playwright/test";
import { CompactEncrypt, SignJWT, exportJWK, generateKeyPair } from "jose";
import { FlowPage } from "./support/flow";
import { DEMO, defaultsFor, seedSettings } from "./support/settings";
import {
  AUTH0,
  stubAuth0Authorization,
  stubAuth0Discovery,
  stubAuth0Jwks,
  type MintTokens,
} from "./support/stubProvider";

// What the Decode and Validate steps make of the tokens they are handed. The
// provider is stubbed, so the tokens are ours to shape: encrypted, stale,
// nonce-mismatched or signed by a key nobody published — every case a live tenant
// will not produce on request.
//
// The round trip itself is the app's own code end to end: the popup, the
// redirect back to /callback/auth-code, the postMessage to the opener, the token
// exchange and the signature verification against the JWKS the issuer advertises.

const SIGNING_KID = "demo-signing-key";
const ENCRYPTION_KID = "demo-encryption-key";
const SUBJECT = "auth0|demo-user";
const ACCESS_SCOPE = "openid profile email read:orders";

type KeyPair = { publicKey: CryptoKey; privateKey: CryptoKey };

let signingKeys: KeyPair;
let unpublishedKeys: KeyPair;
let encryptionKeys: KeyPair;
let publishedJwk: Record<string, unknown>;

test.beforeAll(async () => {
  signingKeys = await generateKeyPair("RS256", { extractable: true });
  // A second signing key, deliberately absent from the JWKS the tenant serves.
  unpublishedKeys = await generateKeyPair("RS256", { extractable: true });
  encryptionKeys = await generateKeyPair("RSA-OAEP-256", { extractable: true });

  publishedJwk = {
    ...(await exportJWK(signingKeys.publicKey)),
    kid: SIGNING_KID,
    alg: "RS256",
    use: "sig",
  };
});

type SignOptions = {
  /** Seconds from now; negative mints an already-expired token. */
  expiresInSec?: number;
  key?: CryptoKey;
};

async function sign(
  claims: Record<string, unknown>,
  { expiresInSec = 3600, key }: SignOptions = {},
) {
  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: SIGNING_KID, typ: "JWT" })
    .setIssuedAt(expiresInSec < 0 ? issuedAt + expiresInSec : issuedAt)
    .setExpirationTime(issuedAt + expiresInSec)
    .sign(key ?? signingKeys.privateKey);
}

function accessTokenClaims() {
  return {
    iss: AUTH0.issuer,
    aud: DEMO.auth0Audience,
    sub: SUBJECT,
    azp: DEMO.auth0Client,
    scope: ACCESS_SCOPE,
    gty: "authorization_code",
  };
}

function idTokenClaims(nonce: string) {
  return {
    iss: AUTH0.issuer,
    aud: DEMO.auth0Client,
    sub: SUBJECT,
    nonce,
    email: "demo.user@demo-tenant.example",
    name: "Demo User",
  };
}

/** A compact JWE, the shape an encrypted access token arrives in. */
async function encryptedAccessToken() {
  return new CompactEncrypt(
    new TextEncoder().encode(JSON.stringify(accessTokenClaims())),
  )
    .setProtectedHeader({
      alg: "RSA-OAEP-256",
      enc: "A256GCM",
      kid: ENCRYPTION_KID,
    })
    .encrypt(encryptionKeys.publicKey);
}

/**
 * Seeds the Auth0 public-client workspace, stubs the tenant, and drives the
 * wizard through authorization, callback and token exchange. Leaves the flow on
 * the Tokens step with `mintTokens`' response received.
 */
async function runRoundTrip(page: Page, mintTokens: MintTokens) {
  await stubAuth0Discovery(page);
  await stubAuth0Jwks(page, [publishedJwk]);
  const traffic = await stubAuth0Authorization(page, mintTokens);

  await seedSettings(page, "auth0", {
    authCodePublicClient: defaultsFor("auth0", {
      pkceEnabled: true,
      scopes: ACCESS_SCOPE,
    }),
  });

  const flow = new FlowPage(page, "auth0", "authorization-code/public-client");
  await flow.goto();
  await flow.advanceTo("Authorize");

  const generate = page.getByRole("button", { name: "Generate", exact: true });
  await generate.nth(0).click();
  await generate.nth(1).click();

  await page.getByRole("button", { name: "Open popup" }).click();

  // the code comes back through the app's own callback page
  await flow.expectStep("Callback");
  await expect(page.locator("#authCode")).not.toHaveValue("");

  await flow.next();
  await flow.expectStep("Tokens");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("#tokenResponse")).not.toHaveValue("");

  return { flow, traffic };
}

/** Runs the Decode step and returns the two decoded payload fields. */
async function decode(flow: FlowPage) {
  await flow.next();
  await flow.expectStep("Decode");
  await flow.page.getByRole("button", { name: "Decode", exact: true }).click();

  return {
    accessHeader: flow.page.locator("#accessHeader"),
    accessPayload: flow.page.locator("#accessPayload"),
    idHeader: flow.page.locator("#idHeader"),
    idPayload: flow.page.locator("#idPayload"),
  };
}

/** The Validate step's per-token block, so identically worded lines stay apart. */
function tokenSection(page: Page, title: "ID Token" | "Access Token") {
  return page.locator(`xpath=//h4[normalize-space()="${title}"]/..`);
}

test.describe("Decode and validate issued tokens", () => {
  test("a full round trip decodes both tokens and validates them", async ({
    page,
  }) => {
    const { flow, traffic } = await runRoundTrip(
      page,
      async ({ authorization }) => ({
        token_type: "Bearer",
        expires_in: 3600,
        scope: ACCESS_SCOPE,
        access_token: await sign(accessTokenClaims()),
        id_token: await sign(
          idTokenClaims(authorization.get("nonce") ?? "missing-nonce"),
        ),
      }),
    );

    // the exchange carried the code from the callback and the PKCE verifier
    const [tokenRequest] = traffic.tokenRequests;
    expect(tokenRequest.grant_type).toBe("authorization_code");
    expect(tokenRequest.code).toBe("demo-authorization-code");
    // RFC 7636's unreserved alphabet, 43-128 characters
    expect(tokenRequest.code_verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);

    const fields = await decode(flow);
    await expect(fields.accessPayload).not.toHaveValue("");

    const accessClaims = JSON.parse(await fields.accessPayload.inputValue());
    expect(accessClaims.iss).toBe(AUTH0.issuer);
    expect(accessClaims.aud).toBe(DEMO.auth0Audience);
    expect(accessClaims.scope).toBe(ACCESS_SCOPE);

    const idClaims = JSON.parse(await fields.idPayload.inputValue());
    expect(idClaims.aud).toBe(DEMO.auth0Client);
    expect(idClaims.sub).toBe(SUBJECT);
    // the nonce the app generated came back in the token it asked for
    expect(idClaims.nonce).toBe(traffic.authorizations[0].get("nonce"));

    expect(JSON.parse(await fields.idHeader.inputValue()).kid).toBe(
      SIGNING_KID,
    );

    await flow.next();
    await flow.expectStep("Validate");

    for (const title of ["ID Token", "Access Token"] as const) {
      const section = tokenSection(page, title);
      // the signature verified against the JWKS the discovery document names
      await expect(
        section.getByText("Verified", { exact: true }),
      ).toBeVisible();
      await expect(section.locator("i.pi-times")).toHaveCount(0);
    }
  });

  test("an encrypted access token is reported, not decoded", async ({
    page,
  }) => {
    // The path a live tenant cannot be asked for on demand, and the reason the
    // Decode step distinguishes JWE from JWS at all.
    const { flow } = await runRoundTrip(page, async ({ authorization }) => ({
      token_type: "Bearer",
      access_token: await encryptedAccessToken(),
      id_token: await sign(
        idTokenClaims(authorization.get("nonce") ?? "missing-nonce"),
      ),
    }));

    const fields = await decode(flow);

    // the protected header is readable, the payload is not
    const accessHeader = JSON.parse(await fields.accessHeader.inputValue());
    expect(accessHeader.enc).toBe("A256GCM");
    expect(accessHeader.kid).toBe(ENCRYPTION_KID);
    await expect(fields.accessPayload).toHaveValue("[Encrypted JWE payload]");
    await expect(
      page.getByText("This token is an encrypted JWE", { exact: false }),
    ).toBeVisible();

    // the ID token beside it is an ordinary JWS and still decodes
    expect(JSON.parse(await fields.idPayload.inputValue()).sub).toBe(SUBJECT);

    await flow.next();
    await flow.expectStep("Validate");

    const access = tokenSection(page, "Access Token");
    // nothing can be verified without the decryption key, and the step says so
    // rather than reporting a failure
    await expect(access.getByText("Skipped", { exact: true })).toBeVisible();
    await expect(
      access.getByText("This access token is an encrypted JWE", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(access.getByText("Not verified", { exact: true })).toHaveCount(
      0,
    );

    await expect(
      tokenSection(page, "ID Token").getByText("Verified", { exact: true }),
    ).toBeVisible();
  });

  test("a token signed with an unpublished key fails signature validation", async ({
    page,
  }) => {
    const { flow } = await runRoundTrip(page, async ({ authorization }) => ({
      token_type: "Bearer",
      access_token: await sign(accessTokenClaims()),
      // same kid, different key: the JWKS lookup succeeds and the signature does
      // not, which is what a substituted token looks like
      id_token: await sign(
        idTokenClaims(authorization.get("nonce") ?? "missing-nonce"),
        { key: unpublishedKeys.privateKey },
      ),
    }));

    await decode(flow);
    await flow.next();
    await flow.expectStep("Validate");

    const idToken = tokenSection(page, "ID Token");
    await expect(
      idToken.getByText("Not verified", { exact: true }),
    ).toBeVisible();
    await expect(idToken.getByText("Reason:", { exact: false })).toBeVisible();

    // the failure is the ID token's alone
    await expect(
      tokenSection(page, "Access Token").getByText("Verified", { exact: true }),
    ).toBeVisible();
  });

  test("a nonce from another request is flagged, and nothing else is", async ({
    page,
  }) => {
    // A correctly signed token for the right client, from the right issuer, that
    // simply answers a different authorization request. Only the nonce catches it.
    const { flow } = await runRoundTrip(page, async () => ({
      token_type: "Bearer",
      access_token: await sign(accessTokenClaims()),
      id_token: await sign(idTokenClaims("nonce-from-another-request")),
    }));

    await decode(flow);
    await flow.next();
    await flow.expectStep("Validate");

    const idToken = tokenSection(page, "ID Token");

    await expect(
      idToken
        .locator("li", { hasText: "nonce must match" })
        .locator("i.pi-times"),
    ).toHaveCount(1);

    await expect(idToken.getByText("Verified", { exact: true })).toBeVisible();
    for (const passing of [
      "aud must match client_id",
      "iss must match provider issuer",
      "exp must be in the future",
    ]) {
      await expect(
        idToken.locator("li", { hasText: passing }).locator("i.pi-check"),
      ).toHaveCount(1);
    }
  });

  test("an expired ID token fails its claim check and its signature check", async ({
    page,
  }) => {
    const { flow } = await runRoundTrip(page, async ({ authorization }) => ({
      token_type: "Bearer",
      access_token: await sign(accessTokenClaims()),
      id_token: await sign(
        idTokenClaims(authorization.get("nonce") ?? "missing-nonce"),
        { expiresInSec: -3600 },
      ),
    }));

    await decode(flow);
    await flow.next();
    await flow.expectStep("Validate");

    const idToken = tokenSection(page, "ID Token");

    await expect(
      idToken
        .locator("li", { hasText: "exp must be in the future" })
        .locator("i.pi-times"),
    ).toHaveCount(1);

    // and the signature line goes red with it: the verifier refuses to vouch for
    // an expired token even when the key matches, so a stale token cannot be
    // reported as signature-valid
    await expect(
      idToken.getByText("Not verified", { exact: true }),
    ).toBeVisible();
    await expect(
      tokenSection(page, "Access Token").getByText("Verified", { exact: true }),
    ).toBeVisible();
  });
});
