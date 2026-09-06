import { expect, test } from "@playwright/test";

// The four server routes that talk to a token endpoint, exercised directly over
// HTTP — no browser, no identity provider.
//
// These carried no coverage at all before: the offline browser specs stub the
// exchange route itself, and the live specs that would reach it skip themselves
// on any machine without tenant credentials. That left `oauthTokenHandlers.ts`
// — the one place a caller-supplied endpoint is validated before the server
// makes a request to it — tested by nothing.
//
// Every case here is refused before the route calls out, so the spec stays
// hermetic. A server-side fetch cannot be intercepted by Playwright, so the
// success path belongs to the live suite.

const AUTH0 = {
  exchange: "/api/oauth/auth0/exchange-token",
  clientCredentials: "/api/oauth/auth0/client-credentials",
  issuerUrl: "https://demo-tenant.eu.auth0.com",
  tokenEndpoint: "https://demo-tenant.eu.auth0.com/oauth/token",
  clientId: "K8sQx2mVdemoClientIdExample7pLzR",
} as const;

const ENTRA = {
  exchange: "/api/oauth/entra/exchange-token",
  clientCredentials: "/api/oauth/entra/client-credentials",
  tenantId: "8f2a1c4e-5b7d-4a19-9c3e-2d6f8a0b1c5d",
  tokenEndpoint:
    "https://login.microsoftonline.com/8f2a1c4e-5b7d-4a19-9c3e-2d6f8a0b1c5d/oauth2/v2.0/token",
  clientId: "3e9b7d21-4c8a-4f16-b5d2-7a1e9c04f8b3",
} as const;

const REDIRECT_URI = "https://localhost:3000/callback/auth-code";
const AUTH_CODE = "demo-authorization-code";

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
  const lines =
    Buffer.from(der)
      .toString("base64")
      .match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
}

test.describe("Token endpoint validation", () => {
  // The routes fetch whatever endpoint the caller names, so what they refuse is
  // the whole of their security value.
  const HOSTILE = [
    ["another host entirely", "https://attacker.example/oauth/token"],
    ["plain HTTP", "http://demo-tenant.eu.auth0.com/oauth/token"],
    [
      "the tenant name as a prefix of someone else's domain",
      "https://demo-tenant.eu.auth0.com.attacker.example/oauth/token",
    ],
  ] as const;

  for (const [description, tokenEndpoint] of HOSTILE) {
    test(`the Auth0 exchange refuses ${description}`, async ({ request }) => {
      const response = await request.post(AUTH0.exchange, {
        data: {
          issuerUrl: AUTH0.issuerUrl,
          clientId: AUTH0.clientId,
          redirectUri: REDIRECT_URI,
          authCode: AUTH_CODE,
          tokenEndpoint,
          clientAuthMethod: "secret",
          clientSecret: "demo-secret",
        },
      });

      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe("invalid_token_endpoint");
    });

    test(`the Auth0 client-credentials route refuses ${description}`, async ({
      request,
    }) => {
      const response = await request.post(AUTH0.clientCredentials, {
        data: {
          issuerUrl: AUTH0.issuerUrl,
          clientId: AUTH0.clientId,
          audience: "https://api.demo-tenant.example/orders",
          tokenEndpoint,
          clientAuthMethod: "secret",
          clientSecret: "demo-secret",
        },
      });

      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe("invalid_token_endpoint");
    });
  }

  for (const [description, tokenEndpoint] of [
    ["another host entirely", "https://attacker.example/oauth2/v2.0/token"],
    [
      "the Microsoft host as a prefix of someone else's domain",
      "https://login.microsoftonline.com.attacker.example/oauth2/v2.0/token",
    ],
    [
      "plain HTTP",
      "http://login.microsoftonline.com/8f2a1c4e-5b7d-4a19-9c3e-2d6f8a0b1c5d/oauth2/v2.0/token",
    ],
  ] as const) {
    test(`the Entra exchange refuses ${description}`, async ({ request }) => {
      const response = await request.post(ENTRA.exchange, {
        data: {
          tenantId: ENTRA.tenantId,
          clientId: ENTRA.clientId,
          redirectUri: REDIRECT_URI,
          authCode: AUTH_CODE,
          tokenEndpoint,
          clientAuthMethod: "secret",
          clientSecret: "demo-secret",
        },
      });

      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe("invalid_token_endpoint");
    });
  }

  test("the Entra exchange refuses an endpoint for a different tenant", async ({
    request,
  }) => {
    // Until the tenant segment was checked, this reached the real Microsoft
    // endpoint — the host allowlist alone said nothing about which tenant, so
    // the request went out and answered `invalid_grant`. It is refused locally
    // now, which is also what keeps this spec hermetic.
    const response = await request.post(ENTRA.exchange, {
      data: {
        tenantId: ENTRA.tenantId,
        clientId: ENTRA.clientId,
        redirectUri: REDIRECT_URI,
        authCode: AUTH_CODE,
        tokenEndpoint:
          "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/oauth2/v2.0/token",
        clientAuthMethod: "secret",
        clientSecret: "demo-secret",
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("invalid_token_endpoint");
  });

  test("the Entra exchange refuses a request with no tenant", async ({
    request,
  }) => {
    // Entra substitutes {tenant} into the endpoint template, so no tenant means
    // no endpoint it can vouch for.
    const response = await request.post(ENTRA.exchange, {
      data: {
        tenantId: "",
        clientId: ENTRA.clientId,
        redirectUri: REDIRECT_URI,
        authCode: AUTH_CODE,
        tokenEndpoint: ENTRA.tokenEndpoint,
        clientAuthMethod: "secret",
        clientSecret: "demo-secret",
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("invalid_token_endpoint");
  });
});

test.describe("Exchange route parameters", () => {
  const base = {
    issuerUrl: AUTH0.issuerUrl,
    clientId: AUTH0.clientId,
    redirectUri: REDIRECT_URI,
    authCode: AUTH_CODE,
    tokenEndpoint: AUTH0.tokenEndpoint,
  };

  for (const omitted of [
    "clientId",
    "redirectUri",
    "authCode",
    "tokenEndpoint",
  ] as const) {
    test(`refuses a request with no ${omitted}`, async ({ request }) => {
      const response = await request.post(AUTH0.exchange, {
        data: { ...base, [omitted]: "" },
      });

      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe("missing_parameters");
    });
  }

  test("requires the secret when the caller says it authenticates with one", async ({
    request,
  }) => {
    const response = await request.post(AUTH0.exchange, {
      data: { ...base, clientAuthMethod: "secret", clientSecret: "" },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("missing_client_secret");
  });

  test("requires the key when the caller says it authenticates with one", async ({
    request,
  }) => {
    const response = await request.post(AUTH0.exchange, {
      data: { ...base, clientAuthMethod: "certificate", privateKeyPem: "" },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("missing_private_key");
  });

  test("refuses an authentication method it does not implement", async ({
    request,
  }) => {
    // A public client authenticates with nothing and exchanges in the browser,
    // so it never reaches this route.
    const response = await request.post(AUTH0.exchange, {
      data: { ...base, clientAuthMethod: "none" },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("invalid_client_auth_method");
  });

  test("an unallowlisted issuer stops a certificate exchange before it signs", async ({
    request,
  }) => {
    const response = await request.post(AUTH0.exchange, {
      data: {
        ...base,
        issuerUrl: "https://attacker.example",
        clientAuthMethod: "certificate",
        privateKeyPem: await generateKeyPem(),
      },
    });

    expect(response.status()).toBe(400);
    // Whichever guard catches it first, nothing was signed for that issuer.
    expect([
      "invalid_token_endpoint",
      "invalid_client_assertion_audience",
    ]).toContain((await response.json()).error);
  });
});

test.describe("Client credentials route parameters", () => {
  test("Auth0 requires an audience, which is how it names the API", async ({
    request,
  }) => {
    const response = await request.post(AUTH0.clientCredentials, {
      data: {
        issuerUrl: AUTH0.issuerUrl,
        clientId: AUTH0.clientId,
        tokenEndpoint: AUTH0.tokenEndpoint,
        // scopes alone are not enough for Auth0
        scopes: "read:orders",
        clientAuthMethod: "secret",
        clientSecret: "demo-secret",
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("missing_audience");
  });

  test("Entra requires scopes, which is how it names the API", async ({
    request,
  }) => {
    const response = await request.post(ENTRA.clientCredentials, {
      data: {
        tenantId: ENTRA.tenantId,
        clientId: ENTRA.clientId,
        tokenEndpoint: ENTRA.tokenEndpoint,
        // an audience means nothing to Entra
        audience: "https://api.demo-tenant.example/orders",
        scopes: "",
        clientAuthMethod: "secret",
        clientSecret: "demo-secret",
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("missing_parameters");
  });

  test("refuses a request with no client id", async ({ request }) => {
    const response = await request.post(AUTH0.clientCredentials, {
      data: {
        issuerUrl: AUTH0.issuerUrl,
        clientId: "",
        audience: "https://api.demo-tenant.example/orders",
        tokenEndpoint: AUTH0.tokenEndpoint,
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("missing_parameters");
  });
});

test.describe("Malformed input", () => {
  for (const [name, route] of [
    ["exchange", AUTH0.exchange],
    ["client credentials", AUTH0.clientCredentials],
  ] as const) {
    test(`the ${name} route answers a non-JSON body without crashing`, async ({
      request,
    }) => {
      // Raw bytes, not a JSON-encoded string: Playwright would serialise a plain
      // string into valid JSON and never reach the parse failure.
      const response = await request.post(route, {
        headers: { "content-type": "application/json" },
        data: Buffer.from("not json at all"),
      });

      expect(response.status()).toBe(500);
      expect((await response.json()).error).toBe("exception");
    });

    test(`the ${name} route answers a JSON body of the wrong shape`, async ({
      request,
    }) => {
      const response = await request.post(route, {
        headers: { "content-type": "application/json" },
        data: Buffer.from(JSON.stringify("a string, not an object")),
      });

      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe("missing_parameters");
    });
  }
});
