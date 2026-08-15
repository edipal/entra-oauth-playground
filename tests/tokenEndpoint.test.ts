import { describe, expect, it } from "vitest";
import { resolveAndValidateTokenEndpoint } from "@/lib/tokenEndpoint";

const TENANT = "11111111-2222-4333-8444-555555555555";
const AUTH0_ISSUER = "https://tenant.eu.auth0.com";

describe("resolveAndValidateTokenEndpoint - Entra", () => {
  it("substitutes the tenant placeholder and accepts Microsoft hosts", () => {
    expect(
      resolveAndValidateTokenEndpoint(
        "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        TENANT,
        { providerId: "entra" },
      ),
    ).toBe(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`);
  });

  it("refuses a non-Microsoft host", () => {
    expect(
      resolveAndValidateTokenEndpoint("https://evil.example/token", TENANT, {
        providerId: "entra",
      }),
    ).toBeNull();
  });

  it("refuses a Microsoft-lookalike host", () => {
    expect(
      resolveAndValidateTokenEndpoint(
        "https://login.microsoftonline.com.evil.test/token",
        TENANT,
        { providerId: "entra" },
      ),
    ).toBeNull();
  });

  it("requires a tenant", () => {
    expect(
      resolveAndValidateTokenEndpoint(
        "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        "",
        { providerId: "entra" },
      ),
    ).toBeNull();
  });
});

describe("resolveAndValidateTokenEndpoint - Auth0", () => {
  it("accepts exactly the endpoint derived from the trusted issuer", () => {
    expect(
      resolveAndValidateTokenEndpoint(
        "https://tenant.eu.auth0.com/oauth/token",
        undefined,
        { providerId: "auth0", issuerUrl: AUTH0_ISSUER },
      ),
    ).toBe("https://tenant.eu.auth0.com/oauth/token");
  });

  it("refuses a different path on the trusted issuer", () => {
    expect(
      resolveAndValidateTokenEndpoint(
        "https://tenant.eu.auth0.com/oauth/anything-else",
        undefined,
        { providerId: "auth0", issuerUrl: AUTH0_ISSUER },
      ),
    ).toBeNull();
  });

  it("refuses an endpoint on a host the issuer does not cover", () => {
    expect(
      resolveAndValidateTokenEndpoint(
        "https://other.eu.auth0.com/oauth/token",
        undefined,
        { providerId: "auth0", issuerUrl: AUTH0_ISSUER },
      ),
    ).toBeNull();
  });

  // The review finding: a caller-supplied issuer must not turn the route into a proxy.
  it("refuses an attacker-controlled issuer even when it matches the endpoint origin", () => {
    expect(
      resolveAndValidateTokenEndpoint(
        "https://evil.example/oauth/token",
        undefined,
        { providerId: "auth0", issuerUrl: "https://evil.example" },
      ),
    ).toBeNull();
  });

  it("refuses when no issuer is supplied", () => {
    expect(
      resolveAndValidateTokenEndpoint(
        "https://tenant.eu.auth0.com/oauth/token",
        undefined,
        { providerId: "auth0" },
      ),
    ).toBeNull();
  });
});

describe("resolveAndValidateTokenEndpoint - general", () => {
  it("refuses non-HTTPS, blank and unparseable endpoints", () => {
    expect(
      resolveAndValidateTokenEndpoint(
        "http://login.microsoftonline.com/t/oauth2/v2.0/token",
        TENANT,
        { providerId: "entra" },
      ),
    ).toBeNull();
    expect(
      resolveAndValidateTokenEndpoint("", TENANT, { providerId: "entra" }),
    ).toBeNull();
    expect(
      resolveAndValidateTokenEndpoint("://nope", TENANT, {
        providerId: "entra",
      }),
    ).toBeNull();
  });

  it("refuses non-string endpoint payloads", () => {
    expect(
      resolveAndValidateTokenEndpoint({ url: "https://x" }, TENANT, {
        providerId: "entra",
      }),
    ).toBeNull();
    expect(
      resolveAndValidateTokenEndpoint(null, TENANT, { providerId: "entra" }),
    ).toBeNull();
  });

  // An unknown provider id normalizes to Entra, which keeps the strict Microsoft rules.
  it("does not let an unknown provider id relax the rules", () => {
    expect(
      resolveAndValidateTokenEndpoint("https://evil.example/token", TENANT, {
        providerId: "okta",
        issuerUrl: "https://evil.example",
      }),
    ).toBeNull();
  });
});
