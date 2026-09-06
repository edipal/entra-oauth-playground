import { type Page } from "@playwright/test";
import { expect, test } from "./support/offlineTest";
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

/** A compact JWE, the shape an encrypted token arrives in. */
async function encrypted(claims: Record<string, unknown>) {
  return new CompactEncrypt(new TextEncoder().encode(JSON.stringify(claims)))
    .setProtectedHeader({
      alg: "RSA-OAEP-256",
      enc: "A256GCM",
      kid: ENCRYPTION_KID,
    })
    .encrypt(encryptionKeys.publicKey);
}

async function encryptedAccessToken() {
  return encrypted(accessTokenClaims());
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

      // Auth0 tokens carry no `ver` claim and its issuer has no /v2.0 segment, so
      // the Entra token-version row used to render a fabricated "1.0?" under a
      // green tick. It has no meaning here and must not appear.
      await expect(
        section.getByText("Extract token version", { exact: false }),
      ).toHaveCount(0);
    }

    // `scp`, `roles` and `wids` are Entra's claim model; Auth0 puts granted
    // scopes in `scope`.
    const accessSection = tokenSection(page, "Access Token");
    await expect(
      accessSection.getByText("scope (granted scopes)", { exact: false }),
    ).toBeVisible();
    await expect(
      accessSection.getByText("scp (delegated scopes)", { exact: false }),
    ).toHaveCount(0);
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

  test("a state mismatch still blocks after a good round trip", async ({
    page,
  }) => {
    // `callbackValidated` used to latch: once a round trip had matched, both step
    // validators short-circuited on it and never compared `state` again. A second
    // callback carrying someone else's state — the CSRF case the parameter exists
    // for — then advanced the wizard exactly as a matching one would.
    let round = 0;
    await stubAuth0Discovery(page);
    await stubAuth0Jwks(page, [publishedJwk]);
    await stubAuth0Authorization(
      page,
      async ({ authorization }) => ({
        token_type: "Bearer",
        access_token: await sign(accessTokenClaims()),
        id_token: await sign(
          idTokenClaims(authorization.get("nonce") ?? "missing-nonce"),
        ),
      }),
      {
        // the first round trip is honest, the second forges the state
        stateInResponse: (sentState) => {
          round += 1;
          return round === 1 ? sentState : "state-from-another-request";
        },
      },
    );

    await seedSettings(page, "auth0", {
      authCodePublicClient: defaultsFor("auth0", {
        pkceEnabled: true,
        scopes: ACCESS_SCOPE,
      }),
    });

    const flow = new FlowPage(
      page,
      "auth0",
      "authorization-code/public-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");

    const generate = page.getByRole("button", {
      name: "Generate",
      exact: true,
    });
    await generate.nth(0).click();
    await generate.nth(1).click();

    await page.getByRole("button", { name: "Open popup" }).click();
    await flow.expectStep("Callback");
    await expect(page.getByLabel("state valid")).toBeVisible();
    await expect(flow.nextButton()).toBeEnabled();

    // round two, with a state that is not the one we sent
    await flow.previous();
    await flow.expectStep("Authorize");
    await page.getByRole("button", { name: "Open popup" }).click();
    await flow.expectStep("Callback");

    await expect(page.getByLabel("state invalid")).toBeVisible();
    await expect(page.locator("#extractedState")).toHaveValue(
      "state-from-another-request",
    );
    // and the wizard refuses to carry the code forward
    await expect(flow.nextButton()).toBeDisabled();
  });

  test("visiting the JWT decoder does not discard the run", async ({
    page,
  }) => {
    // /tools/jwt-decoder sits outside both workspaces, so it names no provider.
    // The active provider fell back to the default, which for an Auth0 user read
    // as a workspace switch — and the switch clears the in-flight runtime.
    const { flow } = await runRoundTrip(page, async ({ authorization }) => ({
      token_type: "Bearer",
      access_token: await sign(accessTokenClaims()),
      id_token: await sign(
        idTokenClaims(authorization.get("nonce") ?? "missing-nonce"),
      ),
    }));

    // The wizard's step position is local component state and unmounts with the
    // page either way. What must survive is the runtime the context holds — the
    // authorization code, the PKCE verifier, the tokens.
    await flow.previous();
    await flow.expectStep("Callback");
    const authCode = await page.locator("#authCode").inputValue();
    expect(authCode).not.toBe("");

    // Through the app's own menu, so this is a client-side navigation and the
    // provider context stays mounted — which is the case the reset misread.
    await page.getByRole("link", { name: "JWT Decoder" }).click();
    await expect(page.locator("#jwtInput")).toBeVisible();

    await page.goBack();
    // Walking back to Callback is itself the assertion: with the runtime cleared
    // the Authorize step has no code to hand on and Next stops being enabled.
    await flow.advanceTo("Callback");
    await expect(page.locator("#authCode")).toHaveValue(authCode);
  });

  test("switching workspace still clears the run", async ({ page }) => {
    // The protection the reset exists for, kept intact by the fix above. Also a
    // client-side navigation, through the workspace selector a user would use.
    const { flow } = await runRoundTrip(page, async ({ authorization }) => ({
      token_type: "Bearer",
      access_token: await sign(accessTokenClaims()),
      id_token: await sign(
        idTokenClaims(authorization.get("nonce") ?? "missing-nonce"),
      ),
    }));

    await flow.previous();
    await flow.expectStep("Callback");
    await expect(page.locator("#authCode")).not.toHaveValue("");

    await page.locator(".provider-selector-sidebar .p-dropdown").click();
    await page
      .locator(".p-dropdown-panel .p-dropdown-item", {
        hasText: "Microsoft Entra ID",
      })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/entra\//);

    await page.locator(".provider-selector-sidebar .p-dropdown").click();
    await page
      .locator(".p-dropdown-panel .p-dropdown-item", { hasText: "Auth0" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/auth0\//);

    // one round trip's code must not survive a trip through the other workspace
    await flow.advanceTo("Authorize");
    await expect(flow.nextButton()).toBeDisabled();
  });

  test("re-authorizing never shows the previous run's tokens", async ({
    page,
  }) => {
    // The natural experiment this app exists for — authorize twice and compare —
    // used to show the first result both times: a new code arrived, but the
    // tokens, decoded claims and streamlined auto-exchange refs from the previous
    // run all survived it.
    let round = 0;
    const { flow } = await runRoundTrip(page, async ({ authorization }) => {
      round += 1;
      return {
        token_type: "Bearer",
        access_token: await sign({
          ...accessTokenClaims(),
          sub: `subject-round-${round}`,
        }),
        id_token: await sign({
          ...idTokenClaims(authorization.get("nonce") ?? "missing-nonce"),
          sub: `subject-round-${round}`,
        }),
      };
    });

    let fields = await decode(flow);
    expect(JSON.parse(await fields.accessPayload.inputValue()).sub).toBe(
      "subject-round-1",
    );

    // back to Authorize and round two
    await flow.previous();
    await flow.expectStep("Tokens");
    await flow.previous();
    await flow.expectStep("Callback");
    await flow.previous();
    await flow.expectStep("Authorize");

    await page.getByRole("button", { name: "Open popup" }).click();
    await flow.expectStep("Callback");

    // the moment the new code lands, nothing from round one is on screen
    await flow.next();
    await flow.expectStep("Tokens");
    await expect(page.locator("#tokenResponse")).toHaveValue("");

    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator("#tokenResponse")).not.toHaveValue("");

    fields = await decode(flow);
    expect(JSON.parse(await fields.accessPayload.inputValue()).sub).toBe(
      "subject-round-2",
    );
    expect(JSON.parse(await fields.idPayload.inputValue()).sub).toBe(
      "subject-round-2",
    );
  });

  test("an opaque access token is explained, and the wizard keeps going", async ({
    page,
  }) => {
    // What Auth0 returns whenever the authorization request names no API
    // audience — a normal outcome, not a broken token. The Decode step used to
    // classify it `invalid`, which stopped the flow dead on the step after a
    // textbook round trip, with nothing said about why.
    const { flow } = await runRoundTrip(page, async ({ authorization }) => ({
      token_type: "Bearer",
      access_token: "vjtOFdSTKp1RxLHhqBcMzYw8gN4uEa2i",
      id_token: await sign(
        idTokenClaims(authorization.get("nonce") ?? "missing-nonce"),
      ),
    }));

    const fields = await decode(flow);
    await expect(fields.accessPayload).toHaveValue(
      "[Opaque token — nothing to decode]",
    );
    await expect(
      page.getByText("This access token is opaque rather than a JWT", {
        exact: false,
      }),
    ).toBeVisible();

    // the step no longer blocks: Decode advances as it would for a JWT
    await flow.next();
    await flow.expectStep("Validate");

    const access = tokenSection(page, "Access Token");
    await expect(access.getByText("Skipped", { exact: true })).toBeVisible();
    await expect(
      access.getByText("This access token is opaque, not a JWT", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(access.locator("i.pi-times")).toHaveCount(0);

    // the ID token beside it is unaffected
    await expect(
      tokenSection(page, "ID Token").getByText("Verified", { exact: true }),
    ).toBeVisible();
  });

  test("an encrypted ID token is reported, not read as a bad signature", async ({
    page,
  }) => {
    // The guard the access token had and the ID token did not: without it a JWE's
    // key-management `alg` (RSA-OAEP-256) reached the signature block, where a
    // "starts with RS" test ticked it green while the signature line went red.
    const { flow } = await runRoundTrip(page, async ({ authorization }) => ({
      token_type: "Bearer",
      access_token: await sign(accessTokenClaims()),
      id_token: await encrypted(
        idTokenClaims(authorization.get("nonce") ?? "missing-nonce"),
      ),
    }));

    await decode(flow);
    await flow.next();
    await flow.expectStep("Validate");

    const idToken = tokenSection(page, "ID Token");
    await expect(idToken.getByText("Skipped", { exact: true })).toBeVisible();
    await expect(
      idToken.getByText("This ID token is an encrypted JWE", { exact: false }),
    ).toBeVisible();

    // no verdict of any kind is claimed about a token this client cannot read
    await expect(idToken.locator("i.pi-check")).toHaveCount(0);
    await expect(idToken.locator("i.pi-times")).toHaveCount(0);

    // the access token beside it is an ordinary JWS and still verifies
    await expect(
      tokenSection(page, "Access Token").getByText("Verified", { exact: true }),
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

  test("an expired ID token fails its claim check, not its signature check", async ({
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

    // The signature line stays green, and that is the point: the published key did
    // sign this token. Reporting a stale token as signature-invalid taught the
    // wrong lesson about which check rejected it — the red `exp` line above is the
    // one that did.
    await expect(idToken.getByText("Verified", { exact: true })).toBeVisible();
    await expect(
      idToken.getByText("Not verified", { exact: true }),
    ).toHaveCount(0);
    await expect(
      tokenSection(page, "Access Token").getByText("Verified", { exact: true }),
    ).toBeVisible();
  });
});
