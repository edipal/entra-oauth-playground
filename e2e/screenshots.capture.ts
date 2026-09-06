import { expect, test, type Page } from "@playwright/test";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { FlowPage } from "./support/flow";
import { DEMO, seedSettings } from "./support/settings";
import {
  entraEndpoints,
  stubAuth0Discovery,
  stubEntraAuthorization,
  stubEntraJwks,
  stubProtectedApi,
} from "./support/stubProvider";

// Regenerates the README screenshots. Opt-in, because it overwrites files in
// docs/screenshots:
//
//   pnpm screenshots
//
// The steps past Authorize used to need a completed sign-in against a real
// tenant, which is why they went stale — and why the ones that existed carried a
// real tenant id, client id and access token into a public repository. They no
// longer do: the provider is stubbed exactly as in the offline suite, so every
// identifier below is a placeholder and every token is minted here.

const SHOTS = "docs/screenshots";

test.skip(
  !process.env.E2E_CAPTURE,
  "screenshot capture is opt-in — run `pnpm screenshots`",
);

// Demo identity, matching the placeholders the earlier screenshots established.
const API_AUDIENCE = "api://demo-orders-api";
const API_ENDPOINT = "https://api.demo-tenant.example/orders";
const SIGNING_KID = "dEm0Kid7Pl4ygr0undSignINgKeY1";
const OID = "7f1e3c9a-2b4d-4e18-9a7c-6d5f8b2e0c31";
const SUB = "AAAAAAAAAAAAAAAAAAAAAI3s9dMhVqUuv0ZuiCz8yQk";
const UPN = "demo.user@demo-tenant.example";
const DISPLAY_NAME = "Demo User";

const ORDERS_RESPONSE = {
  value: [
    {
      id: "ord_10482",
      customer: "Contoso Ltd.",
      total: 149.9,
      currency: "EUR",
      status: "shipped",
    },
    {
      id: "ord_10483",
      customer: "Fabrikam Inc.",
      total: 82.5,
      currency: "EUR",
      status: "processing",
    },
  ],
};

let signingKeys: { publicKey: CryptoKey; privateKey: CryptoKey };
let publishedJwk: Record<string, unknown>;

test.beforeAll(async () => {
  signingKeys = await generateKeyPair("RS256", { extractable: true });
  publishedJwk = {
    ...(await exportJWK(signingKeys.publicKey)),
    kid: SIGNING_KID,
    alg: "RS256",
    use: "sig",
  };
});

async function sign(claims: Record<string, unknown>) {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: SIGNING_KID, typ: "JWT" })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 3599)
    .sign(signingKeys.privateKey);
}

const VIEWPORT_WIDTH = 1440;
const VIEWPORT_HEIGHT = 900;
const MAX_CAPTURE_HEIGHT = 4000;

/**
 * Grows the window to the height of the page and captures the viewport, rather
 * than taking a `fullPage` shot.
 *
 * The sidebar is `position: fixed` and 100vh tall. A full-page capture paints it
 * once, at viewport height, leaving it floating over the content of a longer
 * page — which is what the first attempt at these screenshots produced. Sizing
 * the window to the content instead means there is nothing to scroll, so the
 * layout renders exactly as a reader with a tall enough window would see it.
 */
async function capture(page: Page, name: string) {
  const contentHeight = async () =>
    page.evaluate(() =>
      Math.ceil(
        Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
        ),
      ),
    );

  await page.evaluate(() => globalThis.scrollTo(0, 0));

  // one reflow pass: growing the window can change the height it was measured at
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const height = Math.min(
      Math.max(await contentHeight(), VIEWPORT_HEIGHT),
      MAX_CAPTURE_HEIGHT,
    );
    await page.setViewportSize({ width: VIEWPORT_WIDTH, height });
    await page.waitForTimeout(300);
  }

  await page.screenshot({ path: `${SHOTS}/${name}` });
  await page.setViewportSize({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  });
}

test.describe("Auth0 authorization request", () => {
  test("04-authorize-auth0 — public client", async ({ page }) => {
    await stubAuth0Discovery(page);
    await seedSettings(page, "auth0", {
      authCodePublicClient: {
        providerId: "auth0",
        issuerUrl: DEMO.auth0Issuer,
        clientId: DEMO.auth0Client,
        audience: DEMO.auth0Audience,
        scopes: "openid profile email offline_access",
        pkceEnabled: true,
      },
    });

    const flow = new FlowPage(
      page,
      "auth0",
      "authorization-code/public-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");
    await expect(flow.authUrlPreview).not.toHaveValue("");

    // No request-mode selector here: Auth0 serves PAR to confidential clients
    // only, which is what made the previous version of this shot wrong.
    await expect(page.locator("#auth0RequestMode")).toHaveCount(0);

    await capture(page, "04-authorize-auth0.png");
  });

  test("04-authorize-auth0-confidential — a signed, pushed request", async ({
    page,
  }) => {
    await stubAuth0Discovery(page);
    await seedSettings(page, "auth0", {
      authCodeConfidentialClient: {
        providerId: "auth0",
        issuerUrl: DEMO.auth0Issuer,
        clientId: DEMO.auth0Client,
        audience: DEMO.auth0Audience,
        scopes: "openid profile email offline_access",
        pkceEnabled: true,
        clientAuthMethod: "certificate",
      },
    });

    const flow = new FlowPage(
      page,
      "auth0",
      "authorization-code/confidential-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");

    // PAR + JAR rather than the default: it is the mode that shows the most —
    // the selector, what the mode does, and the signing key the request object
    // needs. An open dropdown panel would list all four labels but wrecks a
    // full-page capture, since the panel is positioned against the viewport.
    await flow.chooseDropdown("auth0RequestMode", "PAR + JAR");
    await expect(page.locator("#auth0RequestObjectKey")).toBeVisible();

    await capture(page, "04-authorize-auth0-confidential.png");
  });
});

test.describe("Entra confidential client, steps 5 to 10", () => {
  test("05 to 10 — a full round trip", async ({ page }) => {
    const endpoints = entraEndpoints(DEMO.entraTenant);

    await stubEntraJwks(page, DEMO.entraTenant, [publishedJwk]);
    await stubProtectedApi(page, API_ENDPOINT, ORDERS_RESPONSE);
    await stubEntraAuthorization(
      page,
      DEMO.entraTenant,
      async ({ authorization }) => ({
        token_type: "Bearer",
        scope: "Orders.Read",
        expires_in: 3599,
        ext_expires_in: 3599,
        access_token: await sign({
          aud: API_AUDIENCE,
          iss: endpoints.issuerV1,
          appid: DEMO.entraClient,
          name: DISPLAY_NAME,
          oid: OID,
          scp: "Orders.Read",
          sub: SUB,
          tid: DEMO.entraTenant,
          upn: UPN,
          ver: "1.0",
        }),
        id_token: await sign({
          aud: DEMO.entraClient,
          iss: endpoints.issuerV2,
          name: DISPLAY_NAME,
          nonce: authorization.get("nonce") ?? "",
          oid: OID,
          preferred_username: UPN,
          sub: SUB,
          tid: DEMO.entraTenant,
          ver: "2.0",
        }),
        refresh_token: "0.ARoAdemo-refresh-token-issued-by-nobody",
      }),
    );

    await seedSettings(page, "entra", {
      authCodeConfidentialClient: {
        providerId: "entra",
        tenantId: DEMO.entraTenant,
        clientId: DEMO.entraClient,
        scopes: `openid profile offline_access ${API_AUDIENCE}/Orders.Read`,
        apiEndpointUrl: API_ENDPOINT,
        pkceEnabled: true,
        clientAuthMethod: "certificate",
      },
    });

    const flow = new FlowPage(
      page,
      "entra",
      "authorization-code/confidential-client",
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
    await expect(page.locator("#authCode")).not.toHaveValue("");
    await capture(page, "05-callback.png");

    await flow.next();
    await flow.expectStep("Authentication");
    // captured before the key pair exists: the empty wizard is what a reader
    // arrives at, and a screenshot is no place for a private key
    await capture(page, "06-authentication.png");

    await page.getByRole("button", { name: "Generate Key Pair" }).click();
    await expect(page.locator("#privateKeyPem")).not.toHaveValue("", {
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Generate Certificate" }).click();
    await expect(page.locator("#thumbprintSha1")).not.toHaveValue("", {
      timeout: 30_000,
    });

    await flow.next();
    await flow.expectStep("Tokens");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator("#tokenResponse")).not.toHaveValue("");
    await capture(page, "07-tokens.png");

    await flow.next();
    await flow.expectStep("Decode");
    await page.getByRole("button", { name: "Decode", exact: true }).click();
    await expect(page.locator("#accessPayload")).not.toHaveValue("");
    await capture(page, "08-decode.png");

    await flow.next();
    await flow.expectStep("Validate");
    // both signature checks resolve asynchronously against the stubbed JWKS
    await expect(page.getByText("Verified", { exact: true })).toHaveCount(2);
    await capture(page, "09-validate.png");

    await flow.next();
    await flow.expectStep("Call API");
    await page.getByRole("button", { name: "Send GET", exact: true }).click();
    await expect(page.locator("#apiResponse")).not.toHaveValue("");
    await capture(page, "10-call-api.png");
  });
});
