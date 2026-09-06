import { describe, expect, it } from "vitest";
import {
  buildProviderMetadataUrl,
  getAuth0TenantAudience,
  getClientAssertionAudience,
  getProviderDefaultApiEndpoint,
  getProviderExpectedParEndpoint,
  getProviderExpectedTokenEndpoint,
  isAllowedProviderIssuer,
  isClientIdValidForProvider,
  isProviderConfigValid,
  issuerMatchesExpected,
  normalizeIssuerUrl,
  normalizeProviderId,
  resolveProviderAuthEndpoint,
  resolveProviderTokenEndpoint,
} from "@/lib/identityProvider";

const TENANT = "11111111-2222-4333-8444-555555555555";

describe("normalizeProviderId", () => {
  it("falls back to Entra for unknown or missing values", () => {
    expect(normalizeProviderId(undefined)).toBe("entra");
    expect(normalizeProviderId("okta")).toBe("entra");
    expect(normalizeProviderId("auth0")).toBe("auth0");
  });
});

describe("normalizeIssuerUrl", () => {
  it("strips query, fragment and trailing slash", () => {
    expect(normalizeIssuerUrl("https://tenant.eu.auth0.com/?a=1#b")).toBe(
      "https://tenant.eu.auth0.com",
    );
  });

  it("refuses non-HTTPS and unparseable input", () => {
    expect(normalizeIssuerUrl("http://tenant.eu.auth0.com")).toBe("");
    expect(normalizeIssuerUrl("not a url")).toBe("");
    expect(normalizeIssuerUrl("")).toBe("");
  });
});

describe("isAllowedProviderIssuer", () => {
  it("accepts hosted Auth0 tenant domains", () => {
    expect(
      isAllowedProviderIssuer("auth0", "https://tenant.eu.auth0.com"),
    ).toBe(true);
    expect(isAllowedProviderIssuer("auth0", "https://x.us.auth0app.com")).toBe(
      true,
    );
  });

  it("refuses lookalike and custom domains", () => {
    expect(isAllowedProviderIssuer("auth0", "https://evil.example")).toBe(
      false,
    );
    expect(isAllowedProviderIssuer("auth0", "https://notauth0.com")).toBe(
      false,
    );
    // suffix match must be on a dot boundary, not a bare string ending
    expect(isAllowedProviderIssuer("auth0", "https://evilauth0.com")).toBe(
      false,
    );
    expect(
      isAllowedProviderIssuer("auth0", "https://auth0.com.evil.test"),
    ).toBe(false);
  });

  it("requires an exact Microsoft host for Entra", () => {
    expect(
      isAllowedProviderIssuer("entra", "https://login.microsoftonline.com"),
    ).toBe(true);
    expect(isAllowedProviderIssuer("entra", "https://sts.windows.net")).toBe(
      true,
    );
    expect(
      isAllowedProviderIssuer(
        "entra",
        "https://evil.login.microsoftonline.com",
      ),
    ).toBe(false);
  });

  it("refuses plain HTTP even on an allowed host", () => {
    expect(isAllowedProviderIssuer("auth0", "http://tenant.eu.auth0.com")).toBe(
      false,
    );
  });
});

describe("expected endpoint derivation", () => {
  it("derives the Auth0 token and PAR endpoints from the issuer origin", () => {
    const issuer = "https://tenant.eu.auth0.com";
    expect(getProviderExpectedTokenEndpoint("auth0", issuer)).toBe(
      "https://tenant.eu.auth0.com/oauth/token",
    );
    expect(getProviderExpectedParEndpoint("auth0", issuer)).toBe(
      "https://tenant.eu.auth0.com/oauth/par",
    );
  });

  it("derives nothing for a disallowed issuer", () => {
    expect(
      getProviderExpectedTokenEndpoint("auth0", "https://evil.example"),
    ).toBe("");
    expect(
      getProviderExpectedParEndpoint("auth0", "https://evil.example"),
    ).toBe("");
  });

  it("derives nothing for Entra, which uses tenant templates instead", () => {
    expect(
      getProviderExpectedTokenEndpoint(
        "entra",
        "https://login.microsoftonline.com",
      ),
    ).toBe("");
  });

  it("builds discovery URLs only for providers that support discovery", () => {
    expect(
      buildProviderMetadataUrl("auth0", "https://tenant.eu.auth0.com"),
    ).toBe("https://tenant.eu.auth0.com/.well-known/openid-configuration");
    expect(
      buildProviderMetadataUrl("entra", "https://login.microsoftonline.com"),
    ).toBe("");
    expect(buildProviderMetadataUrl("auth0", "https://evil.example")).toBe("");
  });
});

describe("endpoint resolution", () => {
  it("substitutes the tenant into the Entra templates", () => {
    expect(
      resolveProviderAuthEndpoint({ providerId: "entra", tenantId: TENANT }),
    ).toBe(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`);
    expect(
      resolveProviderTokenEndpoint({ providerId: "entra", tenantId: TENANT }),
    ).toBe(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`);
  });

  it("uses discovery metadata for Auth0", () => {
    const metadata = {
      authorization_endpoint: "https://tenant.eu.auth0.com/authorize",
      token_endpoint: "https://tenant.eu.auth0.com/oauth/token",
    };
    expect(resolveProviderAuthEndpoint({ providerId: "auth0", metadata })).toBe(
      "https://tenant.eu.auth0.com/authorize",
    );
    expect(
      resolveProviderTokenEndpoint({ providerId: "auth0", metadata }),
    ).toBe("https://tenant.eu.auth0.com/oauth/token");
  });

  it("honours explicit overrides when enabled", () => {
    expect(
      resolveProviderAuthEndpoint({
        providerId: "entra",
        tenantId: TENANT,
        endpointOverrideEnabled: true,
        authEndpointOverride: "https://override.example/authorize",
      }),
    ).toBe("https://override.example/authorize");
  });

  it("ignores overrides that are disabled or blank", () => {
    expect(
      resolveProviderTokenEndpoint({
        providerId: "auth0",
        metadata: { token_endpoint: "https://tenant.eu.auth0.com/oauth/token" },
        endpointOverrideEnabled: true,
        tokenEndpointOverride: "   ",
      }),
    ).toBe("https://tenant.eu.auth0.com/oauth/token");
  });
});

describe("config validity", () => {
  it("requires a GUID tenant for Entra and an allowed issuer for Auth0", () => {
    expect(
      isProviderConfigValid({ providerId: "entra", tenantId: TENANT }),
    ).toBe(true);
    expect(
      isProviderConfigValid({ providerId: "entra", tenantId: "contoso.com" }),
    ).toBe(false);
    expect(
      isProviderConfigValid({
        providerId: "auth0",
        issuerUrl: "https://tenant.eu.auth0.com",
      }),
    ).toBe(true);
    expect(
      isProviderConfigValid({
        providerId: "auth0",
        issuerUrl: "https://evil.example",
      }),
    ).toBe(false);
  });

  it("requires a version and variant conformant GUID, not any hex layout", () => {
    // third group must start 1-5, fourth group must start 8/9/a/b
    expect(
      isProviderConfigValid({
        providerId: "entra",
        tenantId: "11111111-2222-3333-4444-555555555555",
      }),
    ).toBe(false);
    expect(
      isProviderConfigValid({
        providerId: "entra",
        tenantId: "11111111-2222-4333-c444-555555555555",
      }),
    ).toBe(false);
  });

  it("requires a GUID client id for Entra only", () => {
    expect(isClientIdValidForProvider("entra", TENANT)).toBe(true);
    expect(isClientIdValidForProvider("entra", "abc123")).toBe(false);
    expect(isClientIdValidForProvider("auth0", "abc123")).toBe(true);
    expect(isClientIdValidForProvider("auth0", "   ")).toBe(false);
  });

  it("leaves the Auth0 client-credentials defaults empty rather than Microsoft Graph", () => {
    expect(getProviderDefaultApiEndpoint("auth0", "clientCredentials")).toBe(
      "",
    );
    expect(getProviderDefaultApiEndpoint("entra", "clientCredentials")).toBe(
      "https://graph.microsoft.com/v1.0/users",
    );
  });
});

describe("issuerMatchesExpected", () => {
  it("accepts a genuine Entra issuer for the configured tenant", () => {
    expect(
      issuerMatchesExpected(
        `https://login.microsoftonline.com/${TENANT}/v2.0`,
        TENANT,
        "entra",
      ),
    ).toBe(true);
    expect(
      issuerMatchesExpected(
        `https://sts.windows.net/${TENANT}/`,
        TENANT,
        "entra",
      ),
    ).toBe(true);
  });

  it("rejects a forged issuer that merely contains the tenant id", () => {
    expect(
      issuerMatchesExpected(
        `https://attacker.example/${TENANT}`,
        TENANT,
        "entra",
      ),
    ).toBe(false);
    expect(
      issuerMatchesExpected(
        `https://login.microsoftonline.com.evil.test/${TENANT}`,
        TENANT,
        "entra",
      ),
    ).toBe(false);
  });

  it("rejects an Entra issuer for a different tenant", () => {
    expect(
      issuerMatchesExpected(
        "https://login.microsoftonline.com/99999999-2222-4333-8444-555555555555/v2.0",
        TENANT,
        "entra",
      ),
    ).toBe(false);
  });

  it("compares Auth0 issuers exactly, ignoring a trailing slash", () => {
    expect(
      issuerMatchesExpected(
        "https://tenant.eu.auth0.com/",
        "https://tenant.eu.auth0.com",
        "auth0",
      ),
    ).toBe(true);
    expect(
      issuerMatchesExpected(
        "https://other.eu.auth0.com/",
        "https://tenant.eu.auth0.com",
        "auth0",
      ),
    ).toBe(false);
  });

  it("rejects a missing issuer", () => {
    expect(issuerMatchesExpected(undefined, TENANT, "entra")).toBe(false);
  });
});

describe("getAuth0TenantAudience", () => {
  it("appends exactly one trailing slash", () => {
    expect(getAuth0TenantAudience("https://tenant.eu.auth0.com")).toBe(
      "https://tenant.eu.auth0.com/",
    );
    expect(getAuth0TenantAudience("https://tenant.eu.auth0.com/")).toBe(
      "https://tenant.eu.auth0.com/",
    );
  });

  it("refuses an issuer outside the Auth0 allowlist", () => {
    expect(getAuth0TenantAudience("https://attacker.example")).toBe("");
    expect(getAuth0TenantAudience("http://tenant.eu.auth0.com")).toBe("");
    expect(getAuth0TenantAudience(undefined)).toBe("");
  });
});

describe("getClientAssertionAudience", () => {
  const ENTRA_TOKEN_ENDPOINT = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;

  it("gives Auth0 the tenant URL with a trailing slash, not the token endpoint", () => {
    expect(
      getClientAssertionAudience("auth0", {
        issuerUrl: "https://tenant.eu.auth0.com",
        tokenEndpoint: "https://tenant.eu.auth0.com/oauth/token",
      }),
    ).toBe("https://tenant.eu.auth0.com/");
  });

  it("appends exactly one slash when the issuer already ends with one", () => {
    expect(
      getClientAssertionAudience("auth0", {
        issuerUrl: "https://tenant.eu.auth0.com/",
      }),
    ).toBe("https://tenant.eu.auth0.com/");
  });

  it("refuses an issuer outside the Auth0 allowlist", () => {
    expect(
      getClientAssertionAudience("auth0", {
        issuerUrl: "https://attacker.example",
        tokenEndpoint: "https://attacker.example/oauth/token",
      }),
    ).toBe("");
    expect(getClientAssertionAudience("auth0", {})).toBe("");
  });

  it("gives Entra the token endpoint the assertion is sent to", () => {
    expect(
      getClientAssertionAudience("entra", {
        tokenEndpoint: ENTRA_TOKEN_ENDPOINT,
      }),
    ).toBe(ENTRA_TOKEN_ENDPOINT);
  });

  it("treats an unknown provider as Entra, matching normalizeProviderId", () => {
    expect(
      getClientAssertionAudience("okta", {
        issuerUrl: "https://tenant.okta.com",
        tokenEndpoint: ENTRA_TOKEN_ENDPOINT,
      }),
    ).toBe(ENTRA_TOKEN_ENDPOINT);
  });
});
