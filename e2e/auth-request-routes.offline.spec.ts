import { expect, test } from "@playwright/test";
import { decodeJwt, decodeProtectedHeader } from "jose";

// The two Auth0 server routes behind PAR and JAR, exercised directly over HTTP —
// no browser, no identity provider. Both take a caller-supplied issuer and then
// make a server-side request, so what they refuse matters as much as what they do.

const PAR_ROUTE = "/api/oauth/auth0/par";
const REQUEST_OBJECT_ROUTE = "/api/oauth/auth0/request-object";

const ISSUER = "https://demo-tenant.eu.auth0.com";
const CLIENT_ID = "K8sQx2mVdemoClientIdExample7pLzR";
const REDIRECT_URI = "https://localhost:3000/callback/auth-code";

// Throwaway RSA-2048 key. Nothing is registered against it; these routes only
// have to sign with it, not have the signature accepted.
const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1kFEIfXNs1Xb+
xJm5MYyDPCF2mWmKZ8bYqNhGmg+B0BMVsyEuRMWFbBGDMHhOFvxOaHTCEVGpFEss
uCPHnJDHUkiKBWCzGSCTBFHiUXCiWJDCbMEEEHRmU9dNqIGCFRvOZUUyDGnFKMHV
GBGtnBpZmUXHFcMzsMYKmCUgSMdcBGYGVXVOEHBTYNJMDIGVBHYCsvMmZTGKKXPJ
CPMOXQJgUKcMBBTGDUEeIUTNRZOGWXPNPqHqXDNTfEUyGKKJqNVGSHIBIEEGVQwV
mYDNIOPBBHTSUHNGpFqRHFGSPfBWEHIVeMUGGcHTGKFEHTOBPGtvIIEEHNqBHOFG
AgMBAAECggEAAQIDAQABAoIBAQCxYzR3wR6VLvXcTMKKZlDMYnDMPFDGGGGtGMEE
-----END PRIVATE KEY-----`;

test.describe("Auth0 PAR route", () => {
  test("refuses an issuer outside the Auth0 allowlist", async ({ request }) => {
    // Both routes fetch the endpoint they derive from this value, so an
    // arbitrary host here would make the server a request proxy.
    const response = await request.post(PAR_ROUTE, {
      data: {
        issuerUrl: "https://attacker.example",
        authorizationParams: { client_id: CLIENT_ID },
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("invalid_parameters");
  });

  test("refuses a request with no authorization parameters", async ({
    request,
  }) => {
    const response = await request.post(PAR_ROUTE, {
      data: { issuerUrl: ISSUER },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("invalid_parameters");
  });

  test("refuses malformed authorization_details before contacting Auth0", async ({
    request,
  }) => {
    const response = await request.post(PAR_ROUTE, {
      data: {
        issuerUrl: ISSUER,
        authorizationParams: {
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          response_type: "code",
          authorization_details: "not json at all",
        },
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("invalid_authorization_details");
  });

  test("requires the secret when the caller says it authenticates with one", async ({
    request,
  }) => {
    const response = await request.post(PAR_ROUTE, {
      data: {
        issuerUrl: ISSUER,
        authorizationParams: {
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          response_type: "code",
        },
        clientAuthMethod: "secret",
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("missing_client_secret");
  });
});

test.describe("Auth0 request-object route", () => {
  const validBody = {
    issuerUrl: ISSUER,
    clientId: CLIENT_ID,
    privateKeyPem: PRIVATE_KEY_PEM,
    authorizationParams: {
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid profile",
      state: "state-value",
      nonce: "nonce-value",
    },
  };

  test("refuses an issuer outside the Auth0 allowlist", async ({ request }) => {
    const response = await request.post(REQUEST_OBJECT_ROUTE, {
      data: { ...validBody, issuerUrl: "https://attacker.example" },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("invalid_parameters");
  });

  test("refuses a request with no signing key", async ({ request }) => {
    const response = await request.post(REQUEST_OBJECT_ROUTE, {
      data: { ...validBody, privateKeyPem: "" },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("invalid_parameters");
  });

  test("refuses parameters that could not form an authorization request", async ({
    request,
  }) => {
    const response = await request.post(REQUEST_OBJECT_ROUTE, {
      data: {
        ...validBody,
        // no redirect_uri and no response_type
        authorizationParams: { client_id: CLIENT_ID, scope: "openid" },
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("invalid_parameters");
  });

  test("refuses malformed authorization_details", async ({ request }) => {
    const response = await request.post(REQUEST_OBJECT_ROUTE, {
      data: {
        ...validBody,
        authorizationParams: {
          ...validBody.authorizationParams,
          authorization_details: '[{"no":"type"}]',
        },
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("invalid_authorization_details");
  });
});

test.describe("Auth0 request-object route, valid input", () => {
  test("returns a signed request object carrying the authorization parameters", async ({
    request,
  }) => {
    // A key the route can actually import, generated in the browser context so the
    // spec stays self-contained.
    const response = await request.post(REQUEST_OBJECT_ROUTE, {
      data: {
        issuerUrl: ISSUER,
        clientId: CLIENT_ID,
        privateKeyPem: await generateKeyPem(),
        authorizationParams: {
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          response_type: "code",
          scope: "openid profile",
          state: "state-value",
        },
      },
    });

    expect(response.status()).toBe(200);
    const { request: requestObject } = await response.json();
    expect(requestObject, "route should return a request object").toBeTruthy();

    expect(decodeProtectedHeader(requestObject).typ).toBe(
      "oauth-authz-req+jwt",
    );

    const payload = decodeJwt(requestObject);
    expect(payload.iss).toBe(CLIENT_ID);
    // The trailing slash is not cosmetic: Auth0 answers 400 for a request object
    // addressed to the bare issuer.
    expect(payload.aud).toBe(`${ISSUER}/`);
    expect(payload.redirect_uri).toBe(REDIRECT_URI);
    expect(payload.state).toBe("state-value");
  });
});

/** PKCS#8 PEM for a fresh RSA-2048 key, via Node's WebCrypto. */
async function generateKeyPem(): Promise<string> {
  const { subtle } = globalThis.crypto;
  const { privateKey } = await subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );

  const der = await subtle.exportKey("pkcs8", privateKey);
  const base64 = Buffer.from(der).toString("base64");
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
}
