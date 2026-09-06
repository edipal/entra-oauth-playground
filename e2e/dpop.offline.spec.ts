import { type Page } from "@playwright/test";
import { expect, test } from "./support/offlineTest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { FlowPage } from "./support/flow";
import { DEMO, defaultsFor, seedSettings } from "./support/settings";
import { prepareAuthorizeRequest } from "./support/authCode";
import {
  AUTH0,
  stubAuth0Discovery,
  stubAuth0Jwks,
} from "./support/stubProvider";

const SIGNING_KID = "demo-signing-key";
const SUBJECT = "auth0|demo-dpop-user";
const DEMO_KEY = "-----BEGIN PRIVATE KEY-----\nstub\n-----END PRIVATE KEY-----";

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

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".");
  if (parts.length < 2) return {};
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
}

test.describe("Auth0 DPoP (RFC 9449) offline flows", () => {
  test("Public client flow exercises DPoP binding, nonce retry challenge, and API proof with ath", async ({
    page,
  }) => {
    await stubAuth0Discovery(page);
    await stubAuth0Jwks(page, [publishedJwk]);

    await seedSettings(page, "auth0", {
      authCodePublicClient: defaultsFor("auth0", {
        pkceEnabled: true,
        dpopEnabled: true,
      }),
    });

    const flow = new FlowPage(
      page,
      "auth0",
      "authorization-code/public-client",
    );
    await flow.goto();

    // Verify Settings step renders DPoP details and dpop_jkt
    await flow.expectStep("Settings");
    const dpopKeyDetails = page.locator("#dpopKeyDetails");
    await expect(dpopKeyDetails).toBeVisible({ timeout: 15_000 });
    const dpopThumbprint = page.locator("#dpopThumbprint");
    await expect(dpopThumbprint).toBeVisible();
    const clientDpopJkt = (await dpopThumbprint.innerText()).trim();
    expect(clientDpopJkt.length).toBeGreaterThan(10);

    // Advance to Authorize step
    await flow.advanceTo("Authorize");

    // Generate state & nonce
    await prepareAuthorizeRequest(flow);

    // Verify authorize request contains dpop_jkt parameter
    const authUrlPreview = await flow.authUrlPreview.inputValue();
    expect(authUrlPreview).toContain(`dpop_jkt=${encodeURIComponent(clientDpopJkt)}`);

    // Track requests made to AUTH0.token and simulate nonce challenge
    const tokenCalls: { headers: Record<string, string>; body: string }[] = [];
    const TEST_NONCE = "auth0-dpop-nonce-challenge-12345";

    // Stub authorization popup redirect
    await page.context().route(`${AUTH0.authorize}*`, (route) => {
      const params = new URL(route.request().url()).searchParams;
      const sentState = params.get("state") ?? "";
      const callback = new URL(params.get("redirect_uri") ?? "");
      callback.searchParams.set("code", "demo-auth0-dpop-code");
      callback.searchParams.set("state", sentState);

      return route.fulfill({
        status: 302,
        headers: { location: callback.toString() },
        body: "",
      });
    });

    // Stub token endpoint with DPoP nonce challenge on first call
    await page.context().route(AUTH0.token, async (route) => {
      const reqHeaders = route.request().headers();
      const body = route.request().postData() ?? "";
      tokenCalls.push({ headers: reqHeaders, body });

      if (tokenCalls.length === 1) {
        // Challenge with HTTP 400 use_dpop_nonce
        return route.fulfill({
          status: 400,
          headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
            "access-control-expose-headers": "dpop-nonce",
            "dpop-nonce": TEST_NONCE,
          },
          body: JSON.stringify({
            error: "use_dpop_nonce",
            error_description: "Authorization server requires a nonce in the DPoP proof",
          }),
        });
      }

      // Second call: issue DPoP tokens
      const accessToken = await new SignJWT({
        iss: AUTH0.issuer,
        aud: DEMO.auth0Audience,
        sub: SUBJECT,
        scope: "openid profile email",
        cnf: {
          jkt: clientDpopJkt,
        },
      })
        .setProtectedHeader({ alg: "RS256", kid: SIGNING_KID, typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime("2h")
        .sign(signingKeys.privateKey);

      const idToken = await new SignJWT({
        iss: AUTH0.issuer,
        aud: DEMO.auth0Client,
        sub: SUBJECT,
      })
        .setProtectedHeader({ alg: "RS256", kid: SIGNING_KID, typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime("2h")
        .sign(signingKeys.privateKey);

      return route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
        body: JSON.stringify({
          access_token: accessToken,
          id_token: idToken,
          token_type: "DPoP",
          expires_in: 86400,
        }),
      });
    });

    // Launch popup and complete callback
    await page.getByRole("button", { name: "Open popup" }).click();
    await flow.expectStep("Callback");
    await expect(page.locator("#authCode")).toHaveValue("demo-auth0-dpop-code");

    // Advance to Tokens step
    await flow.next();
    await flow.expectStep("Tokens");

    // Send token exchange
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator("#tokenResponse")).not.toHaveValue("", {
      timeout: 15_000,
    });

    // Assert that two token calls were made (nonce retry)
    expect(tokenCalls.length).toBe(2);
    expect(tokenCalls[0].headers["dpop"]).toBeTruthy();
    expect(tokenCalls[1].headers["dpop"]).toBeTruthy();

    // Assert that the second DPoP proof included the server nonce
    const retryProofPayload = decodeJwtPayload(tokenCalls[1].headers["dpop"]);
    expect(retryProofPayload.nonce).toBe(TEST_NONCE);

    // Verify DPoP nonce retry notice and response badge
    await expect(page.locator("#dpopNonceRetryNotice")).toBeVisible();
    await expect(page.getByText("token_type: DPoP", { exact: false })).toBeVisible();

    // Advance to Decode step
    await flow.next();
    await flow.expectStep("Decode");
    await page.getByRole("button", { name: "Decode", exact: true }).click();
    await expect(page.locator("#accessPayload")).not.toHaveValue("");

    // Advance to Validate step
    await flow.next();
    await flow.expectStep("Validate");

    // Verify cnf.jkt checkmark is present and verified
    await expect(
      page.getByText(clientDpopJkt, { exact: false }),
    ).toBeVisible();

    // Advance to Call API step
    await flow.next();
    await flow.expectStep("Call API");

    // Verify API headers preview shows Authorization: DPoP and DPoP header
    const apiHeaders = await page.locator("#apiHeaders").inputValue();
    expect(apiHeaders).toContain("Authorization: DPoP");
    expect(apiHeaders).toContain("DPoP:");

    // Intercept userinfo API request and check DPoP proof
    let capturedApiHeaders: Record<string, string> = {};
    await page.context().route(AUTH0.userinfo, (route) => {
      capturedApiHeaders = route.request().headers();
      return route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
        body: JSON.stringify({
          sub: SUBJECT,
          email: "dpop-user@example.com",
        }),
      });
    });

    // Call API
    await page.getByRole("button", { name: "Send GET", exact: true }).click();
    await expect(page.locator("#apiResponse")).not.toHaveValue("", {
      timeout: 15_000,
    });

    // Verify API request carried DPoP headers with ath
    expect(capturedApiHeaders["authorization"]).toContain("DPoP");
    expect(capturedApiHeaders["dpop"]).toBeTruthy();
    const apiProofPayload = decodeJwtPayload(capturedApiHeaders["dpop"]);
    expect(apiProofPayload.htm).toBe("GET");
    expect(apiProofPayload.ath).toBeTruthy();
    expect(typeof apiProofPayload.ath).toBe("string");
  });

  test("Confidential client passes dpop_jkt in PAR and JAR requests", async ({
    page,
  }) => {
    await stubAuth0Discovery(page);

    // 1. Test PAR mode
    let parParams: Record<string, unknown> = {};
    await page.route("**/api/oauth/auth0/par", async (route) => {
      parParams = route.request().postDataJSON()?.authorizationParams ?? {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ request_uri: "urn:ietf:params:oauth:request_uri:mock-par" }),
      });
    });

    await seedSettings(page, "auth0", {
      authCodeConfidentialClient: defaultsFor("auth0", {
        pkceEnabled: true,
        dpopEnabled: true,
        authRequestMode: "par",
      }),
    });

    const flow = new FlowPage(
      page,
      "auth0",
      "authorization-code/confidential-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");
    await prepareAuthorizeRequest(flow);

    // Fill client secret on the Authorize step for PAR push
    await page.locator("#auth0ParClientSecret").fill("demo-client-secret");

    // Click "Push to PAR"
    const pushButton = page.getByRole("button", {
      name: "Push to PAR",
      exact: true,
    });
    await expect(pushButton).toBeVisible();
    await pushButton.click();

    await expect.poll(() => parParams.dpop_jkt).toBeTruthy();
    expect(typeof parParams.dpop_jkt).toBe("string");

    // 2. Test JAR mode
    let jarClaims: Record<string, unknown> = {};
    await page.route("**/api/oauth/auth0/request-object", async (route) => {
      jarClaims = route.request().postDataJSON()?.authorizationParams ?? {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ request: "eyJhbGciOiJSUzI1NiJ9.stub.sig" }),
      });
    });

    // Stub popup authorize redirect for JAR launch
    await page.context().route(`${AUTH0.authorize}*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>stub jar authorize</body></html>",
      }),
    );

    await seedSettings(page, "auth0", {
      authCodeConfidentialClient: defaultsFor("auth0", {
        pkceEnabled: true,
        dpopEnabled: true,
        authRequestMode: "jar",
      }),
    });

    await flow.goto();
    await flow.advanceTo("Authorize");
    await prepareAuthorizeRequest(flow);

    // Fill private key for JAR request object
    await page.locator("#auth0RequestObjectKey").fill(DEMO_KEY);

    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Open popup" }).click();
    const popup = await popupPromise;
    await popup.waitForURL(/\/authorize/, { timeout: 15_000 });
    await popup.close();

    await expect.poll(() => jarClaims.dpop_jkt).toBeTruthy();
    expect(typeof jarClaims.dpop_jkt).toBe("string");
  });

  test("Client credentials flow sends DPoP proof and receives DPoP token_type", async ({
    page,
  }) => {
    await stubAuth0Discovery(page);

    let capturedBody: Record<string, unknown> = {};
    await page.route("**/api/oauth/auth0/client-credentials", async (route) => {
      capturedBody = route.request().postDataJSON() ?? {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-dpop-m2m-token",
          token_type: "DPoP",
          expires_in: 86400,
        }),
      });
    });

    await seedSettings(page, "auth0", {
      clientCredentials: defaultsFor("auth0", {
        dpopEnabled: true,
        clientAuthMethod: "secret",
        audience: DEMO.auth0Audience,
      }),
    });

    const flow = new FlowPage(page, "auth0", "client-credentials");
    await flow.goto();

    // Advance to Authentication step
    await flow.advanceTo("Authentication");

    // Fill client secret
    await page.locator("#clientSecret").fill("demo-client-secret");

    // Advance to Tokens step
    await flow.advanceTo("Tokens");

    // Send token request
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator("#tokenResponse")).not.toHaveValue("", {
      timeout: 15_000,
    });

    // Assert DPoP proof was sent to route
    expect(capturedBody.dpopProof).toBeTruthy();
    expect(typeof capturedBody.dpopProof).toBe("string");

    // Assert DPoP badge is visible
    await expect(page.getByText("token_type: DPoP", { exact: false })).toBeVisible();
  });
});
