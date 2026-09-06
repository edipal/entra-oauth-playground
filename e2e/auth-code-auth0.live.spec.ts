import { expect, test, type Page } from "@playwright/test";
import { FlowPage } from "./support/flow";
import { seedSettings } from "./support/settings";
import { auth0, auth0PkJwt, requires } from "./support/credentials";
import { authorizeThroughPopup } from "./support/signin";
import {
  decodeTokens,
  expectCallbackFor,
  prepareAuthorizeRequest,
  sendTokenRequest,
  validateAndCallApi,
} from "./support/authCode";

// Full authorization-code round trips against a real Auth0 tenant: sign in, exchange
// the code, decode, validate, call the API.
//
// A public client redeems the code in the browser against /oauth/token, which is why
// the SPA needs an allowed web origin; a confidential client redeems it server-side
// through /api/oauth/auth0/exchange-token. Both are covered, with and without PKCE.

function requiresInteractiveAuth0(extra: Record<string, string> = {}) {
  requires({
    E2E_AUTH0_ISSUER_URL: auth0.issuerUrl,
    E2E_AUTH0_AUDIENCE: auth0.audience,
    E2E_AUTH0_USERNAME: auth0.username,
    E2E_AUTH0_PASSWORD: auth0.password,
    ...extra,
  });
}

/** Decode, validate, and spend the access token on the configured API. */
async function decodeAndCallApi(
  flow: FlowPage,
  expected: {
    clientId: string;
    nonce: string;
    tenant?: typeof auth0 | typeof auth0PkJwt;
    expectedRarType?: string;
  },
) {
  const tenant = expected.tenant || auth0;
  const { access, id } = await decodeTokens(flow);

  expect(access.iss).toBe(`${tenant.issuerUrl}/`);
  expect([].concat(access.aud)).toContain(tenant.audience);

  if (expected.expectedRarType) {
    expect(access.authorization_details).toEqual([
      { type: expected.expectedRarType },
    ]);
  }

  expect(id.aud).toBe(expected.clientId);
  expect(id.nonce, "nonce must round-trip into the ID token").toBe(
    expected.nonce,
  );

  const body = await validateAndCallApi(flow);
  expect(body, `the API said: ${body}`).toContain("sub");
}

test.describe("Auth0 authorization code (public client)", () => {
  test("with PKCE, completes the whole flow", async ({ page }) => {
    requiresInteractiveAuth0({
      E2E_AUTH0_PUBLIC_CLIENT_ID: auth0.publicClientId,
    });

    await seedSettings(page, "auth0", {
      authCodePublicClient: {
        providerId: "auth0",
        issuerUrl: auth0.issuerUrl,
        clientId: auth0.publicClientId,
        audience: auth0.audience,
        scopes: auth0.userScopes,
        apiEndpointUrl: auth0.apiEndpoint,
        pkceEnabled: true,
        streamlined: false,
      },
    });

    const flow = new FlowPage(
      page,
      "auth0",
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
    expect(params.client_id).toBe(auth0.publicClientId);
    // Without an audience Auth0 issues an opaque token instead of a JWT.
    expect(params.audience).toBe(auth0.audience);
    expect(params.state, "state should be on the request").toBeTruthy();
    expect(params.nonce, "nonce should be on the request").toBeTruthy();

    await authorizeThroughPopup(page, "auth0");
    await expectCallbackFor(flow, params.state);

    await flow.next();
    await flow.expectStep("Tokens");

    // Auth0 rejects a code exchange that repeats the authorization-time extras,
    // so the app deliberately drops scope and audience from this request.
    const requestBody = await page.locator("#tokenRequestBody").inputValue();
    expect(requestBody).toContain("code_verifier");
    expect(requestBody, "audience must not be echoed back").not.toMatch(
      /\baudience\b/,
    );
    expect(requestBody, "scope must not be echoed back").not.toMatch(
      /\bscope\b/,
    );

    const body = await sendTokenRequest(page);
    expect(body, `token endpoint said: ${body}`).toContain("access_token");
    expect(body).toContain("id_token");

    await decodeAndCallApi(flow, {
      clientId: auth0.publicClientId,
      nonce: params.nonce,
    });
  });

  test("with RAR on plain URL, Auth0 refuses and directs to PAR", async ({
    page,
  }) => {
    requiresInteractiveAuth0({
      E2E_AUTH0_PUBLIC_CLIENT_ID: auth0.publicClientId,
    });

    const rarPayload = '[{"type":"payment_initiation"}]';

    await seedSettings(page, "auth0", {
      authCodePublicClient: {
        providerId: "auth0",
        issuerUrl: auth0.issuerUrl,
        clientId: auth0.publicClientId,
        audience: auth0.audience,
        scopes: auth0.userScopes,
        apiEndpointUrl: auth0.apiEndpoint,
        pkceEnabled: true,
        streamlined: false,
        rarJson: rarPayload,
      },
    });

    const flow = new FlowPage(
      page,
      "auth0",
      "authorization-code/public-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");

    const params = await prepareAuthorizeRequest(flow);
    expect(params.authorization_details).toBe(rarPayload);

    // Auth0 disallows authorization_details on the frontchannel GET /authorize URL,
    // immediately redirecting back with error=invalid_request without showing login form.
    await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("button", { name: "Open popup" }).click(),
    ]);

    await flow.expectStep("Callback");
    await expect(flow.page.locator("#callbackError")).toHaveValue(
      "invalid_request",
      { timeout: 20_000 },
    );
    expect(
      await flow.page.locator("#callbackErrorDescription").inputValue(),
    ).toContain("please use it in PAR instead");
  });

  test("without PKCE, the code still redeems", async ({ page }) => {
    requiresInteractiveAuth0({
      E2E_AUTH0_PUBLIC_CLIENT_ID: auth0.publicClientId,
    });

    await seedSettings(page, "auth0", {
      authCodePublicClient: {
        providerId: "auth0",
        issuerUrl: auth0.issuerUrl,
        clientId: auth0.publicClientId,
        audience: auth0.audience,
        scopes: auth0.userScopes,
        apiEndpointUrl: auth0.apiEndpoint,
        pkceEnabled: false,
        streamlined: false,
      },
    });

    const flow = new FlowPage(
      page,
      "auth0",
      "authorization-code/public-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");

    const params = await prepareAuthorizeRequest(flow);
    expect(params.code_challenge, "PKCE must be off for this case").toBe(
      undefined,
    );

    await authorizeThroughPopup(page, "auth0");
    await expectCallbackFor(flow, params.state);

    await flow.next();
    await flow.expectStep("Tokens");

    // Unlike Entra, Auth0 does not force PKCE on a public client. This pins that
    // difference: the same configuration Entra refuses outright succeeds here.
    const body = await sendTokenRequest(page);
    expect(body, `token endpoint said: ${body}`).toContain("access_token");
  });
});

/** Walks the confidential flow up to the client-authentication step. */
async function authorizeConfidentialClient(
  page: Page,
  options: {
    pkceEnabled: boolean;
    clientAuthMethod?: "secret" | "certificate";
    // private_key_jwt may live on its own tenant; everything for the round trip
    // has to come from the same one.
    tenant?: typeof auth0 | typeof auth0PkJwt;
    clientId?: string;
    clientAssertionKid?: string;
    authRequestMode?: "url" | "par" | "jar" | "par-jar";
    rarJson?: string;
    /** Runs on the Authorize step before the popup is opened. */
    beforeLaunch?: (flow: FlowPage) => Promise<void>;
  },
) {
  const tenant = options.tenant || auth0;
  const clientId = options.clientId || auth0.confidentialClientId;

  await seedSettings(page, "auth0", {
    authCodeConfidentialClient: {
      providerId: "auth0",
      issuerUrl: tenant.issuerUrl,
      clientId,
      audience: tenant.audience,
      scopes: tenant.userScopes,
      apiEndpointUrl: tenant.apiEndpoint,
      pkceEnabled: options.pkceEnabled,
      streamlined: false,
      clientAuthMethod: options.clientAuthMethod || "secret",
      clientAssertionKid: options.clientAssertionKid,
      authRequestMode: options.authRequestMode,
      rarJson: options.rarJson,
    },
  });

  const flow = new FlowPage(
    page,
    "auth0",
    "authorization-code/confidential-client",
  );
  await flow.goto();
  await flow.advanceTo("Authorize");

  const params = await prepareAuthorizeRequest(flow);
  expect(params.client_id).toBe(clientId);

  const state =
    params.state || (await flow.page.locator("#state").inputValue());
  const nonce =
    params.nonce || (await flow.page.locator("#nonce").inputValue());

  if (!options.authRequestMode || options.authRequestMode === "url") {
    expect(params.audience).toBe(tenant.audience);
    if (options.pkceEnabled) {
      expect(params.code_challenge_method).toBe("S256");
    } else {
      expect(params.code_challenge).toBe(undefined);
    }
    if (options.rarJson) {
      expect(params.authorization_details).toBe(options.rarJson);
    }
  } else if (options.authRequestMode === "jar") {
    expect(params.request).toBe("[signed_jwt_request_object]");
    expect(params.audience).toBeUndefined();
  } else {
    // par or par-jar. Nothing has been pushed yet — prepareAuthorizeRequest reads
    // the preview, and in PAR mode that is the placeholder the step shows until a
    // request_uri exists. Asserting the placeholder is what is actually knowable
    // here; that a real one replaces it is proven by the sign-in below, which
    // cannot succeed unless the push did.
    expect(params.request_uri).toBe(
      "urn:ietf:params:oauth:request_uri:[push_par_to_obtain_request_uri]",
    );
    expect(params.audience).toBeUndefined();
  }

  await options.beforeLaunch?.(flow);

  await authorizeThroughPopup(page, "auth0", tenant);
  await expectCallbackFor(flow, state);

  await flow.next();
  await flow.expectStep("Authentication");

  return { flow, params: { ...params, state, nonce } };
}

test.describe("Auth0 authorization code (confidential client)", () => {
  test("client secret, with PKCE", async ({ page }) => {
    requiresInteractiveAuth0({
      E2E_AUTH0_CONFIDENTIAL_CLIENT_ID: auth0.confidentialClientId,
      E2E_AUTH0_CLIENT_SECRET: auth0.clientSecret,
    });

    const { flow, params } = await authorizeConfidentialClient(page, {
      pkceEnabled: true,
    });

    await flow.fill("clientSecret", auth0.clientSecret);
    await flow.next();
    await flow.expectStep("Tokens");

    // Confidential clients redeem server-side, via /api/oauth/auth0/exchange-token.
    const body = await sendTokenRequest(page);
    expect(body, `token endpoint said: ${body}`).toContain("access_token");
    expect(body).toContain("id_token");

    await decodeAndCallApi(flow, {
      clientId: auth0.confidentialClientId,
      nonce: params.nonce,
    });
  });

  test("client secret, without PKCE", async ({ page }) => {
    requiresInteractiveAuth0({
      E2E_AUTH0_CONFIDENTIAL_CLIENT_ID: auth0.confidentialClientId,
      E2E_AUTH0_CLIENT_SECRET: auth0.clientSecret,
    });

    const { flow, params } = await authorizeConfidentialClient(page, {
      pkceEnabled: false,
    });

    await flow.fill("clientSecret", auth0.clientSecret);
    await flow.next();
    await flow.expectStep("Tokens");

    // The client secret is what authenticates the client here, so PKCE is optional.
    const body = await sendTokenRequest(page);
    expect(body, `token endpoint said: ${body}`).toContain("access_token");

    await decodeAndCallApi(flow, {
      clientId: auth0.confidentialClientId,
      nonce: params.nonce,
    });
  });

  test("private_key_jwt, with PKCE", async ({ page }) => {
    requires({
      E2E_AUTH0_PKJWT_ISSUER_URL: auth0PkJwt.issuerUrl,
      E2E_AUTH0_PKJWT_CLIENT_ID: auth0PkJwt.confidentialClientId,
      E2E_AUTH0_PKJWT_AUDIENCE: auth0PkJwt.audience,
      E2E_AUTH0_PKJWT_USERNAME: auth0PkJwt.username,
      E2E_AUTH0_PKJWT_PASSWORD: auth0PkJwt.password,
      E2E_AUTH0_PRIVATE_KEY_PEM: auth0PkJwt.privateKeyPem,
      E2E_AUTH0_CREDENTIAL_KID: auth0PkJwt.credentialKid,
    });

    const { flow, params } = await authorizeConfidentialClient(page, {
      pkceEnabled: true,
      tenant: auth0PkJwt,
      clientId: auth0PkJwt.confidentialClientId,
      clientAuthMethod: "certificate",
      clientAssertionKid: auth0PkJwt.credentialKid,
    });

    await flow.chooseDropdown(
      "clientAuthMethod",
      "Private key (private_key_jwt)",
    );
    await flow.fill("privateKeyPem", auth0PkJwt.privateKeyPem);

    // Entra needs a certificate here; Auth0 registers the public key instead, so
    // the step must be completable with a key and a kid alone.
    await expect(flow.page.locator("#certificatePem")).toHaveCount(0);

    await flow.next();
    await flow.expectStep("Tokens");

    // The assertion is signed server-side, with the tenant URL as `aud`.
    const body = await sendTokenRequest(page);
    expect(body, `token endpoint said: ${body}`).toContain("access_token");
    expect(body).toContain("id_token");

    await decodeAndCallApi(flow, {
      clientId: auth0PkJwt.confidentialClientId,
      nonce: params.nonce,
      tenant: auth0PkJwt,
    });
  });
});

/**
 * PAR, JAR and PAR + JAR against a real tenant. These need the Highly Regulated
 * Identity features: tenant-level "Allow PAR", a request-object credential on the
 * application, and both per-application "Require" toggles left off — requiring a
 * mode makes every other one fail. See e2e/README.md.
 */
test.describe("Auth0 authorization code (request modes)", () => {
  function requiresPkJwtTenant() {
    requires({
      E2E_AUTH0_PKJWT_ISSUER_URL: auth0PkJwt.issuerUrl,
      E2E_AUTH0_PKJWT_CLIENT_ID: auth0PkJwt.confidentialClientId,
      E2E_AUTH0_PKJWT_AUDIENCE: auth0PkJwt.audience,
      E2E_AUTH0_PKJWT_USERNAME: auth0PkJwt.username,
      E2E_AUTH0_PKJWT_PASSWORD: auth0PkJwt.password,
      E2E_AUTH0_PRIVATE_KEY_PEM: auth0PkJwt.privateKeyPem,
      E2E_AUTH0_CREDENTIAL_KID: auth0PkJwt.credentialKid,
    });
  }

  /** The signing key is entered on the Authorize step, where it is first needed. */
  const supplySigningKey = async (flow: FlowPage) => {
    await flow.fill("auth0RequestObjectKey", auth0PkJwt.privateKeyPem);
    await flow.fill("auth0RequestObjectKid", auth0PkJwt.credentialKid);
  };

  async function runMode(
    page: Page,
    mode: "par" | "jar" | "par-jar",
    options?: { rarJson?: string; expectedRarType?: string },
  ) {
    const { flow, params } = await authorizeConfidentialClient(page, {
      pkceEnabled: true,
      tenant: auth0PkJwt,
      clientId: auth0PkJwt.confidentialClientId,
      clientAuthMethod: "certificate",
      clientAssertionKid: auth0PkJwt.credentialKid,
      authRequestMode: mode,
      rarJson: options?.rarJson,
      beforeLaunch: supplySigningKey,
    });

    // The callback proves Auth0 accepted the request: it only issues a code after
    // resolving the pushed request_uri or verifying the signed request object.
    await flow.fill("privateKeyPem", auth0PkJwt.privateKeyPem);
    await flow.next();
    await flow.expectStep("Tokens");

    const body = await sendTokenRequest(page);
    expect(body, `token endpoint said: ${body}`).toContain("access_token");

    await decodeAndCallApi(flow, {
      clientId: auth0PkJwt.confidentialClientId,
      nonce: params.nonce,
      tenant: auth0PkJwt,
      expectedRarType: options?.expectedRarType,
    });
  }

  test("PAR pushes the request and launches with a request_uri", async ({
    page,
  }) => {
    requiresPkJwtTenant();
    await runMode(page, "par");
  });

  test("PAR with RAR pushes the request and returns authorization_details", async ({
    page,
  }) => {
    requiresPkJwtTenant();
    await runMode(page, "par", {
      rarJson: '[{"type":"payment_initiation"}]',
      expectedRarType: "payment_initiation",
    });
  });

  test("PAR + JAR with RAR pushes the signed request object and returns authorization_details", async ({
    page,
  }) => {
    requiresPkJwtTenant();
    await runMode(page, "par-jar", {
      rarJson: '[{"type":"payment_initiation"}]',
      expectedRarType: "payment_initiation",
    });
  });

  test("JAR launches with a signed request object", async ({ page }) => {
    requiresPkJwtTenant();
    // Auth0 rejects a request object addressed to the bare issuer, so this also
    // pins the trailing slash on the request object's `aud`.
    await runMode(page, "jar");
  });

  test("PAR + JAR pushes the signed request object", async ({ page }) => {
    requiresPkJwtTenant();
    await runMode(page, "par-jar");
  });
});

test.describe("Auth0 authorization code (streamlined mode)", () => {
  test("runs the exchange and decode without further clicks", async ({
    page,
  }) => {
    requiresInteractiveAuth0({
      E2E_AUTH0_PUBLIC_CLIENT_ID: auth0.publicClientId,
    });

    await seedSettings(page, "auth0", {
      authCodePublicClient: {
        providerId: "auth0",
        issuerUrl: auth0.issuerUrl,
        clientId: auth0.publicClientId,
        audience: auth0.audience,
        scopes: auth0.userScopes,
        apiEndpointUrl: auth0.apiEndpoint,
        pkceEnabled: true,
        streamlined: true,
      },
    });

    const flow = new FlowPage(
      page,
      "auth0",
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

    await authorizeThroughPopup(page, "auth0");

    // No Next clicks from here: the callback jumps straight to Tokens, the
    // exchange fires on arrival, and the decode advances to Validate on its own.
    await flow.expectStep("Validate");

    // The decoded payloads live on the step streamlined mode already moved past,
    // so step back to check that the automation really did produce tokens.
    await flow.previous();
    await flow.expectStep("Decode");

    const access = JSON.parse(
      await page.locator("#accessPayload").inputValue(),
    );
    expect(access.iss).toBe(`${auth0.issuerUrl}/`);

    const id = JSON.parse(await page.locator("#idPayload").inputValue());
    expect(id.nonce).toBe(params.nonce);
  });
});
