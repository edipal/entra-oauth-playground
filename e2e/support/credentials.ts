import { test } from "@playwright/test";

// Live-tenant configuration. Values come from .env.e2e.local (gitignored), loaded
// by playwright.config.ts. Nothing here is ever committed.

const env = (name: string) => process.env[name]?.trim() || "";

export const entra = {
  tenantId: env("E2E_ENTRA_TENANT_ID"),
  publicClientId: env("E2E_ENTRA_PUBLIC_CLIENT_ID"),
  confidentialClientId: env("E2E_ENTRA_CONFIDENTIAL_CLIENT_ID"),
  clientSecret: env("E2E_ENTRA_CLIENT_SECRET"),
  privateKeyPem: env("E2E_ENTRA_PRIVATE_KEY_PEM").replaceAll("\\n", "\n"),
  certificatePem: env("E2E_ENTRA_CERTIFICATE_PEM").replaceAll("\\n", "\n"),
  clientAssertionX5t: env("E2E_ENTRA_CLIENT_ASSERTION_X5T"),
  userScopes: env("E2E_ENTRA_USER_SCOPES") || "openid profile offline_access",
  appScope:
    env("E2E_ENTRA_APP_SCOPE") || "https://graph.microsoft.com/.default",
  apiEndpoint:
    env("E2E_ENTRA_API_ENDPOINT") || "https://graph.microsoft.com/v1.0/me",
  username: env("E2E_ENTRA_USERNAME"),
  password: env("E2E_ENTRA_PASSWORD"),
};

export const auth0 = {
  issuerUrl: env("E2E_AUTH0_ISSUER_URL"),
  publicClientId: env("E2E_AUTH0_PUBLIC_CLIENT_ID"),
  confidentialClientId: env("E2E_AUTH0_CONFIDENTIAL_CLIENT_ID"),
  clientSecret: env("E2E_AUTH0_CLIENT_SECRET"),
  m2mClientId: env("E2E_AUTH0_M2M_CLIENT_ID"),
  m2mClientSecret: env("E2E_AUTH0_M2M_CLIENT_SECRET"),
  privateKeyPem: env("E2E_AUTH0_PRIVATE_KEY_PEM").replaceAll("\\n", "\n"),
  // Auth0 derives this from the JWK thumbprint of the public key, so registering
  // the same key on several applications yields the same kid for all of them.
  credentialKid: env("E2E_AUTH0_CREDENTIAL_KID"),
  audience: env("E2E_AUTH0_AUDIENCE"),
  userScopes: env("E2E_AUTH0_USER_SCOPES") || "openid profile email",
  apiEndpoint: env("E2E_AUTH0_API_ENDPOINT"),
  username: env("E2E_AUTH0_USERNAME"),
  password: env("E2E_AUTH0_PASSWORD"),
};

/**
 * Private Key JWT configuration, which may live on a different Auth0 tenant than
 * everything above.
 *
 * Two Auth0 constraints push it there. The token-endpoint authentication method
 * is exclusive per application, so an application set to Private Key JWT loses
 * the client secret the other specs authenticate with; and a tenant allows only
 * a limited number of application credentials, which a long-lived tenant can
 * already have spent. Each value falls back to its single-tenant equivalent, so
 * a tenant that can host everything needs only the client ids.
 */
export const auth0PkJwt = {
  issuerUrl: env("E2E_AUTH0_PKJWT_ISSUER_URL") || auth0.issuerUrl,
  m2mClientId: env("E2E_AUTH0_PKJWT_M2M_CLIENT_ID"),
  confidentialClientId: env("E2E_AUTH0_PKJWT_CLIENT_ID"),
  audience: env("E2E_AUTH0_PKJWT_AUDIENCE") || auth0.audience,
  apiEndpoint: env("E2E_AUTH0_PKJWT_API_ENDPOINT") || auth0.apiEndpoint,
  username: env("E2E_AUTH0_PKJWT_USERNAME") || auth0.username,
  password: env("E2E_AUTH0_PKJWT_PASSWORD") || auth0.password,
  privateKeyPem: auth0.privateKeyPem,
  credentialKid: auth0.credentialKid,
  userScopes: auth0.userScopes,
};

/**
 * Skips the current test unless every named value is configured, so the suite
 * stays green for anyone without tenant access.
 */
export function requires(values: Record<string, string>) {
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  test.skip(
    missing.length > 0,
    `missing credentials: ${missing.join(", ")} (see .env.e2e.example)`,
  );
}
