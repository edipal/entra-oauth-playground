import { expect, test } from "@playwright/test";
import { FlowPage } from "./support/flow";
import { seedSettings } from "./support/settings";
import { auth0, auth0PkJwt, entra, requires } from "./support/credentials";

// Real client-credentials round trips: token request, decode, validate, call API.
// No browser sign-in is involved, so these are the most reliable live specs.

async function exchangeAndAssert(flow: FlowPage, expectedInIssuer: string) {
  await flow.advanceTo("Tokens");

  await flow.page.getByRole("button", { name: "Send", exact: true }).click();

  const response = flow.page.locator("#tokenResponse");
  await expect(response).not.toHaveValue("", { timeout: 30_000 });

  const body = await response.inputValue();
  expect(body, `token endpoint returned: ${body}`).toContain("access_token");

  await flow.next();
  await flow.expectStep("Decode");
  await flow.page.getByRole("button", { name: "Decode" }).click();

  const header = flow.page.locator("#accessHeader");
  await expect(header).not.toHaveValue("", { timeout: 10_000 });

  const payload = await flow.page.locator("#accessPayload").inputValue();
  if (payload.trim().startsWith("{")) {
    // A JWT access token: the issuer must name the tenant we configured. Entra
    // uses either login.microsoftonline.com or the v1 sts.windows.net form
    // depending on the resource, so assert on the tenant rather than the host.
    expect(JSON.parse(payload).iss).toContain(expectedInIssuer);
  } else {
    // Auth0 may issue an encrypted JWE; the header still decodes
    expect(JSON.parse(await header.inputValue())).toHaveProperty("alg");
  }
}

test.describe("Entra client credentials", () => {
  test("client secret", async ({ page }) => {
    requires({
      E2E_ENTRA_TENANT_ID: entra.tenantId,
      E2E_ENTRA_CONFIDENTIAL_CLIENT_ID: entra.confidentialClientId,
      E2E_ENTRA_CLIENT_SECRET: entra.clientSecret,
    });

    await seedSettings(page, "entra", {
      clientCredentials: {
        providerId: "entra",
        tenantId: entra.tenantId,
        clientId: entra.confidentialClientId,
        scopes: entra.appScope,
        apiEndpointUrl: entra.apiEndpoint,
        clientAuthMethod: "secret",
      },
    });

    const flow = new FlowPage(page, "entra", "client-credentials");
    await flow.goto();
    await flow.advanceTo("Authentication");
    await flow.fill("clientSecret", entra.clientSecret);

    await exchangeAndAssert(flow, entra.tenantId);
  });

  test("private_key_jwt (certificate)", async ({ page }) => {
    requires({
      E2E_ENTRA_TENANT_ID: entra.tenantId,
      E2E_ENTRA_CONFIDENTIAL_CLIENT_ID: entra.confidentialClientId,
      E2E_ENTRA_PRIVATE_KEY_PEM: entra.privateKeyPem,
      E2E_ENTRA_CERTIFICATE_PEM: entra.certificatePem,
      E2E_ENTRA_CLIENT_ASSERTION_X5T: entra.clientAssertionX5t,
    });

    await seedSettings(page, "entra", {
      clientCredentials: {
        providerId: "entra",
        tenantId: entra.tenantId,
        clientId: entra.confidentialClientId,
        scopes: entra.appScope,
        apiEndpointUrl: entra.apiEndpoint,
        clientAuthMethod: "certificate",
        clientAssertionX5t: entra.clientAssertionX5t,
      },
    });

    const flow = new FlowPage(page, "entra", "client-credentials");
    await flow.goto();
    await flow.advanceTo("Authentication");
    await flow.chooseDropdown(
      "clientAuthMethod",
      "Certificate (private_key_jwt)",
    );
    await flow.fill("privateKeyPem", entra.privateKeyPem);
    await flow.fill("certificatePem", entra.certificatePem);

    // the app derives the SHA-1 thumbprint from the certificate
    await expect(flow.page.locator("#thumbprintSha1")).not.toHaveValue("");

    await exchangeAndAssert(flow, entra.tenantId);
  });
});

test.describe("Auth0 client credentials", () => {
  test("client secret", async ({ page }) => {
    requires({
      E2E_AUTH0_ISSUER_URL: auth0.issuerUrl,
      E2E_AUTH0_M2M_CLIENT_ID: auth0.m2mClientId,
      E2E_AUTH0_M2M_CLIENT_SECRET: auth0.m2mClientSecret,
      E2E_AUTH0_AUDIENCE: auth0.audience,
    });

    await seedSettings(page, "auth0", {
      clientCredentials: {
        providerId: "auth0",
        issuerUrl: auth0.issuerUrl,
        clientId: auth0.m2mClientId,
        audience: auth0.audience,
        apiEndpointUrl: auth0.apiEndpoint,
        clientAuthMethod: "secret",
      },
    });

    const flow = new FlowPage(page, "auth0", "client-credentials");
    await flow.goto();
    await flow.advanceTo("Authentication");
    await flow.fill("clientSecret", auth0.m2mClientSecret);

    await exchangeAndAssert(flow, auth0.issuerUrl);
  });

  test("private_key_jwt (registered public key)", async ({ page }) => {
    requires({
      E2E_AUTH0_PKJWT_ISSUER_URL: auth0PkJwt.issuerUrl,
      E2E_AUTH0_PKJWT_M2M_CLIENT_ID: auth0PkJwt.m2mClientId,
      E2E_AUTH0_PRIVATE_KEY_PEM: auth0PkJwt.privateKeyPem,
      E2E_AUTH0_CREDENTIAL_KID: auth0PkJwt.credentialKid,
      E2E_AUTH0_PKJWT_AUDIENCE: auth0PkJwt.audience,
    });

    await seedSettings(page, "auth0", {
      clientCredentials: {
        providerId: "auth0",
        issuerUrl: auth0PkJwt.issuerUrl,
        clientId: auth0PkJwt.m2mClientId,
        audience: auth0PkJwt.audience,
        apiEndpointUrl: auth0PkJwt.apiEndpoint,
        clientAuthMethod: "certificate",
        clientAssertionKid: auth0PkJwt.credentialKid,
      },
    });

    const flow = new FlowPage(page, "auth0", "client-credentials");
    await flow.goto();
    await flow.advanceTo("Authentication");
    await flow.chooseDropdown(
      "clientAuthMethod",
      "Private key (private_key_jwt)",
    );
    await flow.fill("privateKeyPem", auth0PkJwt.privateKeyPem);

    // no certificate is involved for Auth0 — the kid identifies the credential
    await expect(flow.page.locator("#certificatePem")).toHaveCount(0);
    await expect(flow.page.locator("#clientAssertionKid")).toHaveValue(
      auth0PkJwt.credentialKid,
    );

    await exchangeAndAssert(flow, auth0PkJwt.issuerUrl);
  });

  test("audience is required", async ({ page }) => {
    requires({
      E2E_AUTH0_ISSUER_URL: auth0.issuerUrl,
      E2E_AUTH0_M2M_CLIENT_ID: auth0.m2mClientId,
    });

    await seedSettings(page, "auth0", {
      clientCredentials: {
        providerId: "auth0",
        issuerUrl: auth0.issuerUrl,
        clientId: auth0.m2mClientId,
        audience: "",
        clientAuthMethod: "secret",
      },
    });

    const flow = new FlowPage(page, "auth0", "client-credentials");
    await flow.goto();
    await flow.expectStep("Settings");

    // the flow must not let an audience-less Auth0 request through
    await expect(flow.nextButton()).toBeDisabled();
  });
});
