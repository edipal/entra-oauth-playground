import { describe, expect, it } from "vitest";
import { findTokenExchangeBlocker } from "@/lib/tokenExchangeReadiness";

// Every one of these was a bare `return` inside handleExchangeTokens while the
// Send button stayed enabled, so pressing it did nothing visible at all.

const confidential = {
  providerConfigValid: true,
  clientId: "K8sQx2mVdemoClientIdExample7pLzR",
  redirectUri: "https://localhost:3000/callback/auth-code",
  tokenEndpoint: "https://demo-tenant.eu.auth0.com/oauth/token",
  authCode: "demo-authorization-code",
  pkceEnabled: true,
  codeVerifier: "a".repeat(43),
  clientAuthMethod: "secret" as const,
  clientSecret: "demo-secret",
  privateKeyPem: "",
};

describe("findTokenExchangeBlocker", () => {
  it("returns null when everything the exchange needs is present", () => {
    expect(findTokenExchangeBlocker(confidential)).toBeNull();
  });

  it("names the missing client secret", () => {
    expect(
      findTokenExchangeBlocker({ ...confidential, clientSecret: "" }),
    ).toBe("clientSecret");
  });

  it("names the missing private key only for certificate authentication", () => {
    expect(
      findTokenExchangeBlocker({
        ...confidential,
        clientAuthMethod: "certificate",
        clientSecret: "",
        privateKeyPem: "",
      }),
    ).toBe("privateKey");
  });

  it("ignores the PKCE verifier when PKCE is off", () => {
    expect(
      findTokenExchangeBlocker({
        ...confidential,
        pkceEnabled: false,
        codeVerifier: "",
      }),
    ).toBeNull();
    expect(
      findTokenExchangeBlocker({ ...confidential, codeVerifier: "" }),
    ).toBe("codeVerifier");
  });

  it("reports the earliest unmet precondition, not an arbitrary one", () => {
    // Everything missing at once: the answer is the first thing to go and fix,
    // which is the one furthest back in the wizard.
    expect(
      findTokenExchangeBlocker({
        providerConfigValid: false,
        clientId: "",
        redirectUri: "",
        tokenEndpoint: "",
        authCode: "",
        clientAuthMethod: "secret",
        clientSecret: "",
      }),
    ).toBe("providerConfig");
  });

  it("does not ask a public client for a credential it never has", () => {
    // No clientAuthMethod: nothing authenticates the client.
    expect(
      findTokenExchangeBlocker({
        providerConfigValid: true,
        clientId: "public-client",
        redirectUri: "https://localhost:3000/callback/auth-code",
        tokenEndpoint: "https://demo-tenant.eu.auth0.com/oauth/token",
        authCode: "demo-authorization-code",
        pkceEnabled: true,
        codeVerifier: "a".repeat(43),
      }),
    ).toBeNull();
  });

  it("checks the grant parameters client credentials needs, and no redirect URI", () => {
    const machine = {
      providerConfigValid: true,
      clientId: "machine-client",
      tokenEndpoint: "https://demo-tenant.eu.auth0.com/oauth/token",
      grantParametersValid: true,
      clientAuthMethod: "secret" as const,
      clientSecret: "demo-secret",
    };

    expect(findTokenExchangeBlocker(machine)).toBeNull();
    expect(
      findTokenExchangeBlocker({ ...machine, grantParametersValid: false }),
    ).toBe("grantParameters");
  });
});
