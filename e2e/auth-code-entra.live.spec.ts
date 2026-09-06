import { expect, test, type Page } from "@playwright/test";
import { FlowPage } from "./support/flow";
import { seedSettings } from "./support/settings";
import { entra, requires } from "./support/credentials";
import { authorizeThroughPopup } from "./support/signin";
import {
  decodeTokens,
  expectCallbackFor,
  prepareAuthorizeRequest,
  sendTokenRequest,
  validateAndCallApi,
} from "./support/authCode";

// Full authorization-code round trips against a real Entra tenant: sign in, exchange
// the code, decode, validate, call Microsoft Graph.
//
// The two client types take genuinely different paths. A public client redeems the
// code in the browser against Entra's CORS-enabled SPA endpoint; a confidential
// client redeems it server-side through /api/oauth/entra/exchange-token. Both are
// covered here, with and without PKCE.

// Entra names a resource by its application id rather than its hostname.
const GRAPH_APP_ID = "00000003-0000-0000-c000-000000000000";

function requiresInteractiveEntra(extra: Record<string, string> = {}) {
  requires({
    E2E_ENTRA_TENANT_ID: entra.tenantId,
    E2E_ENTRA_USERNAME: entra.username,
    E2E_ENTRA_PASSWORD: entra.password,
    ...extra,
  });
}

/** Decode, validate, and spend the access token on Microsoft Graph. */
async function decodeAndCallGraph(
  flow: FlowPage,
  expected: { clientId: string; nonce: string },
) {
  const { access, id } = await decodeTokens(flow);

  // A Graph-scoped access token is issued in the v1 format, so its issuer is
  // sts.windows.net rather than login.microsoftonline.com. Assert the tenant.
  expect(access.iss).toContain(entra.tenantId);
  expect([].concat(access.aud).join(" ")).toMatch(
    new RegExp(`${GRAPH_APP_ID}|graph\\.microsoft\\.com`),
  );

  expect(id.aud).toBe(expected.clientId);
  expect(id.tid).toBe(entra.tenantId);
  expect(id.nonce, "nonce must round-trip into the ID token").toBe(
    expected.nonce,
  );

  const graph = await validateAndCallApi(flow);
  expect(graph, `Graph said: ${graph}`).not.toContain(
    "InvalidAuthenticationToken",
  );
  expect(graph).toContain("userPrincipalName");
}

test.describe("Entra authorization code (public client)", () => {
  test("with PKCE, completes the whole flow", async ({ page }) => {
    requiresInteractiveEntra({
      E2E_ENTRA_PUBLIC_CLIENT_ID: entra.publicClientId,
    });

    await seedSettings(page, "entra", {
      authCodePublicClient: {
        providerId: "entra",
        tenantId: entra.tenantId,
        clientId: entra.publicClientId,
        scopes: entra.userScopes,
        apiEndpointUrl: entra.apiEndpoint,
        pkceEnabled: true,
        streamlined: false,
      },
    });

    const flow = new FlowPage(
      page,
      "entra",
      "authorization-code/public-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");

    const params = await prepareAuthorizeRequest(flow);
    expect(params.code_challenge_method).toBe("S256");
    expect(
      params.code_challenge,
      "PKCE challenge must be present",
    ).toBeTruthy();
    expect(params.client_id).toBe(entra.publicClientId);
    expect(params.response_type).toBe("code");
    expect(params.scope).toContain("openid");
    expect(params.state, "state should be on the request").toBeTruthy();
    expect(params.nonce, "nonce should be on the request").toBeTruthy();

    await authorizeThroughPopup(page, "entra");
    await expectCallbackFor(flow, params.state);

    await flow.next();
    await flow.expectStep("Tokens");
    // Public clients redeem in the browser, against Entra's CORS-enabled endpoint.
    const body = await sendTokenRequest(page);
    expect(body, `token endpoint said: ${body}`).toContain("access_token");
    expect(body).toContain("id_token");

    await decodeAndCallGraph(flow, {
      clientId: entra.publicClientId,
      nonce: params.nonce,
    });
  });

  test("without PKCE, Entra refuses to redeem the code", async ({ page }) => {
    requiresInteractiveEntra({
      E2E_ENTRA_PUBLIC_CLIENT_ID: entra.publicClientId,
    });

    await seedSettings(page, "entra", {
      authCodePublicClient: {
        providerId: "entra",
        tenantId: entra.tenantId,
        clientId: entra.publicClientId,
        scopes: entra.userScopes,
        pkceEnabled: false,
        streamlined: false,
      },
    });

    const flow = new FlowPage(
      page,
      "entra",
      "authorization-code/public-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");

    const params = await prepareAuthorizeRequest(flow);
    expect(params.code_challenge, "PKCE must be off for this case").toBe(
      undefined,
    );

    await authorizeThroughPopup(page, "entra");
    await flow.expectStep("Callback");

    // Entra knows this redirect URI belongs to the Single-page application
    // platform, so it refuses the authorization request outright and redirects
    // back with an error rather than issuing a code that could never be redeemed.
    await expect(page.locator("#callbackError")).not.toHaveValue("", {
      timeout: 20_000,
    });
    expect(
      await page.locator("#callbackErrorDescription").inputValue(),
    ).toContain("AADSTS9002325");
  });
});

test.describe("Entra authorization code (confidential client)", () => {
  /** Walks the confidential flow up to the client-authentication step. */
  async function authorizeConfidentialClient(
    page: Page,
    options: {
      pkceEnabled: boolean;
      clientAuthMethod: "secret" | "certificate";
      responseMode?: "query" | "form_post";
    },
  ) {
    await seedSettings(page, "entra", {
      authCodeConfidentialClient: {
        providerId: "entra",
        tenantId: entra.tenantId,
        clientId: entra.confidentialClientId,
        scopes: entra.userScopes,
        apiEndpointUrl: entra.apiEndpoint,
        pkceEnabled: options.pkceEnabled,
        streamlined: false,
        clientAuthMethod: options.clientAuthMethod,
        ...(options.clientAuthMethod === "certificate"
          ? { clientAssertionX5t: entra.clientAssertionX5t }
          : {}),
      },
    });

    const flow = new FlowPage(
      page,
      "entra",
      "authorization-code/confidential-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");

    if (options.responseMode) {
      await flow.chooseDropdown("responseMode", options.responseMode);
    }

    const params = await prepareAuthorizeRequest(flow);
    expect(params.client_id).toBe(entra.confidentialClientId);
    if (options.pkceEnabled) {
      expect(params.code_challenge_method).toBe("S256");
    } else {
      expect(params.code_challenge).toBeUndefined();
    }
    if (options.responseMode) {
      expect(params.response_mode).toBe(options.responseMode);
    }

    await authorizeThroughPopup(page, "entra");
    await expectCallbackFor(flow, params.state);

    await flow.next();
    await flow.expectStep("Authentication");

    return { flow, params };
  }

  test("client secret, with PKCE", async ({ page }) => {
    requiresInteractiveEntra({
      E2E_ENTRA_CONFIDENTIAL_CLIENT_ID: entra.confidentialClientId,
      E2E_ENTRA_CLIENT_SECRET: entra.clientSecret,
    });

    const { flow, params } = await authorizeConfidentialClient(page, {
      pkceEnabled: true,
      clientAuthMethod: "secret",
    });

    await flow.fill("clientSecret", entra.clientSecret);
    await flow.next();
    await flow.expectStep("Tokens");

    // Confidential clients redeem server-side, through /api/oauth/entra/exchange-token.
    const body = await sendTokenRequest(page);
    expect(body, `token endpoint said: ${body}`).toContain("access_token");
    expect(body).toContain("id_token");

    await decodeAndCallGraph(flow, {
      clientId: entra.confidentialClientId,
      nonce: params.nonce,
    });
  });

  test("client secret, without PKCE", async ({ page }) => {
    requiresInteractiveEntra({
      E2E_ENTRA_CONFIDENTIAL_CLIENT_ID: entra.confidentialClientId,
      E2E_ENTRA_CLIENT_SECRET: entra.clientSecret,
    });

    const { flow, params } = await authorizeConfidentialClient(page, {
      pkceEnabled: false,
      clientAuthMethod: "secret",
    });

    await flow.fill("clientSecret", entra.clientSecret);
    await flow.next();
    await flow.expectStep("Tokens");

    // Unlike the SPA platform, a Web-platform client may redeem without PKCE:
    // the client secret is what authenticates it.
    const body = await sendTokenRequest(page);
    expect(body, `token endpoint said: ${body}`).toContain("access_token");

    await decodeAndCallGraph(flow, {
      clientId: entra.confidentialClientId,
      nonce: params.nonce,
    });
  });

  test("certificate (private_key_jwt)", async ({ page }) => {
    requiresInteractiveEntra({
      E2E_ENTRA_CONFIDENTIAL_CLIENT_ID: entra.confidentialClientId,
      E2E_ENTRA_PRIVATE_KEY_PEM: entra.privateKeyPem,
      E2E_ENTRA_CERTIFICATE_PEM: entra.certificatePem,
    });

    const { flow, params } = await authorizeConfidentialClient(page, {
      pkceEnabled: true,
      clientAuthMethod: "certificate",
    });

    await flow.chooseDropdown(
      "clientAuthMethod",
      "Certificate (private_key_jwt)",
    );
    await flow.fill("privateKeyPem", entra.privateKeyPem);
    await flow.fill("certificatePem", entra.certificatePem);

    // the app derives the SHA-1 thumbprint from the pasted certificate
    await expect(flow.page.locator("#thumbprintSha1")).not.toHaveValue("");

    await flow.next();
    await flow.expectStep("Tokens");

    const body = await sendTokenRequest(page);
    expect(body, `token endpoint said: ${body}`).toContain("access_token");

    await decodeAndCallGraph(flow, {
      clientId: entra.confidentialClientId,
      nonce: params.nonce,
    });
  });

  test("response_mode=form_post returns the code in the request body", async ({
    page,
  }) => {
    requiresInteractiveEntra({
      E2E_ENTRA_CONFIDENTIAL_CLIENT_ID: entra.confidentialClientId,
      E2E_ENTRA_CLIENT_SECRET: entra.clientSecret,
    });

    const { flow } = await authorizeConfidentialClient(page, {
      pkceEnabled: true,
      clientAuthMethod: "secret",
      responseMode: "form_post",
    });

    // form_post is the only thing that exercises the POST branch of the callback
    // route: Entra posts the code as a form body instead of a query string.
    await flow.previous();
    await flow.expectStep("Callback");
    const callbackBody = await page.locator("#callbackBody").inputValue();
    expect(
      callbackBody,
      "the callback should have received a form body",
    ).toContain("code=");
    expect(await page.locator("#callbackUrl").inputValue()).not.toContain(
      "code=",
    );

    await flow.next();
    await flow.expectStep("Authentication");
    await flow.fill("clientSecret", entra.clientSecret);
    await flow.next();
    await flow.expectStep("Tokens");

    const body = await sendTokenRequest(page);
    expect(body, `token endpoint said: ${body}`).toContain("access_token");
  });
});

test.describe("Entra authorization code (streamlined mode)", () => {
  test("runs the exchange and decode without further clicks", async ({
    page,
  }) => {
    requiresInteractiveEntra({
      E2E_ENTRA_PUBLIC_CLIENT_ID: entra.publicClientId,
    });

    await seedSettings(page, "entra", {
      authCodePublicClient: {
        providerId: "entra",
        tenantId: entra.tenantId,
        clientId: entra.publicClientId,
        scopes: entra.userScopes,
        apiEndpointUrl: entra.apiEndpoint,
        pkceEnabled: true,
        streamlined: true,
      },
    });

    const flow = new FlowPage(
      page,
      "entra",
      "authorization-code/public-client",
    );
    await flow.goto();
    // Streamlined mode skips the PKCE step and generates the verifier in the
    // background, so wait for the challenge to reach the request.
    await flow.advanceTo("Authorize");
    await expect
      .poll(async () => (await flow.authorizeParams()).code_challenge_method, {
        timeout: 10_000,
      })
      .toBe("S256");

    const params = await prepareAuthorizeRequest(flow);

    await authorizeThroughPopup(page, "entra");

    // No Next clicks from here: the callback jumps straight to Tokens, the
    // exchange fires on arrival, and the decode advances to Validate on its own.
    await flow.expectStep("Validate");

    // The decoded payloads live on the step streamlined mode already moved past,
    // so step back to check that the automation really did produce tokens.
    await flow.previous();
    await flow.expectStep("Decode");

    const claims = JSON.parse(
      await page.locator("#accessPayload").inputValue(),
    );
    expect(claims.iss).toContain(entra.tenantId);

    const idClaims = JSON.parse(await page.locator("#idPayload").inputValue());
    expect(idClaims.nonce).toBe(params.nonce);
  });
});
