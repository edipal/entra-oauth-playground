import type { Page } from "@playwright/test";
import { DEMO } from "./settings";

// A stand-in for the Auth0 tenant the offline specs configure, so a whole
// authorization-code round trip can run with nothing but the app and these
// handlers.
//
// Auth0 answers discovery for any subdomain, so a spec that does not stub it
// quietly reaches the real internet to resolve its endpoints. Stubbing keeps the
// offline project hermetic.
//
// Route the exact paths, never the whole origin: a wildcard on the issuer also
// swallows /.well-known/openid-configuration, and without it the workspace cannot
// resolve its endpoints or leave the Settings step — which presents as a series
// of unrelated "Next is disabled" failures.

export const AUTH0 = {
  issuer: `${DEMO.auth0Issuer}/`,
  discovery: `${DEMO.auth0Issuer}/.well-known/openid-configuration`,
  authorize: `${DEMO.auth0Issuer}/authorize`,
  token: `${DEMO.auth0Issuer}/oauth/token`,
  jwks: `${DEMO.auth0Issuer}/.well-known/jwks.json`,
  userinfo: `${DEMO.auth0Issuer}/userinfo`,
} as const;

// Everything below is fetched by the page from another origin, so each response
// has to say so or the browser hides it from the app.
const JSON_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
};

export const AUTH0_DISCOVERY = {
  issuer: AUTH0.issuer,
  authorization_endpoint: AUTH0.authorize,
  token_endpoint: AUTH0.token,
  jwks_uri: AUTH0.jwks,
  userinfo_endpoint: AUTH0.userinfo,
};

/** Resolves the Auth0 workspace's endpoints without leaving the machine. */
export async function stubAuth0Discovery(page: Page) {
  await page.context().route(AUTH0.discovery, (route) =>
    route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify(AUTH0_DISCOVERY),
    }),
  );
}

/** Serves the keys the Validate step verifies token signatures against. */
export async function stubAuth0Jwks(page: Page, keys: unknown[]) {
  await page.context().route(AUTH0.jwks, (route) =>
    route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ keys }),
    }),
  );
}

export type TokenResponse = Record<string, unknown>;

export type MintTokens = (context: {
  /** What the app sent to /authorize — `nonce` in particular. */
  authorization: URLSearchParams;
  /** The decoded form body of the token request. */
  tokenRequest: Record<string, string>;
}) => TokenResponse | Promise<TokenResponse>;

export type ProviderTraffic = {
  authorizations: URLSearchParams[];
  tokenRequests: Record<string, string>[];
};

/**
 * Completes an authorization request without a sign-in: /authorize redirects
 * straight back to the app's own callback with a code, which is the same path a
 * real provider takes once the user is done. The popup, the callback page and the
 * postMessage back to the opener are all the app's real code.
 *
 * Returns the traffic it recorded, so a spec can assert on what was sent.
 */
export async function stubAuth0Authorization(
  page: Page,
  mintTokens: MintTokens,
  options: { authorizationCode?: string } = {},
): Promise<ProviderTraffic> {
  const code = options.authorizationCode ?? "demo-authorization-code";
  const traffic: ProviderTraffic = { authorizations: [], tokenRequests: [] };

  await page.context().route(`${AUTH0.authorize}*`, (route) => {
    const params = new URL(route.request().url()).searchParams;
    traffic.authorizations.push(params);

    const callback = new URL(params.get("redirect_uri") ?? "");
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", params.get("state") ?? "");

    return route.fulfill({
      status: 302,
      headers: { location: callback.toString() },
      body: "",
    });
  });

  await page.context().route(AUTH0.token, async (route) => {
    const tokenRequest = Object.fromEntries(
      new URLSearchParams(route.request().postData() ?? ""),
    );
    traffic.tokenRequests.push(tokenRequest);

    const body = await mintTokens({
      authorization: traffic.authorizations.at(-1) ?? new URLSearchParams(),
      tokenRequest,
    });

    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
  });

  return traffic;
}

// --- Microsoft Entra ID -----------------------------------------------------
//
// Entra needs no discovery stub: the app derives its endpoints from the tenant
// through a template. The confidential flow also exchanges the code through the
// app's own /api/oauth/entra/exchange-token route rather than in the browser, so
// that is what gets stubbed instead of the provider's token endpoint.

export function entraEndpoints(tenantId: string) {
  const tenant = `https://login.microsoftonline.com/${tenantId}`;

  return {
    authorize: `${tenant}/oauth2/v2.0/authorize`,
    jwks: `${tenant}/discovery/v2.0/keys`,
    /** What an Entra v2.0 ID token names as its issuer. */
    issuerV2: `${tenant}/v2.0`,
    /** What a v1.0 access token for a custom API names — note the trailing slash. */
    issuerV1: `https://sts.windows.net/${tenantId}/`,
  };
}

export async function stubEntraJwks(
  page: Page,
  tenantId: string,
  keys: unknown[],
) {
  await page.context().route(entraEndpoints(tenantId).jwks, (route) =>
    route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ keys }),
    }),
  );
}

export type MintEntraTokens = (context: {
  authorization: URLSearchParams;
  /** The JSON body the app posted to its own exchange route. */
  exchangeRequest: Record<string, unknown>;
}) => TokenResponse | Promise<TokenResponse>;

/** The Entra counterpart of {@link stubAuth0Authorization}. */
export async function stubEntraAuthorization(
  page: Page,
  tenantId: string,
  mintTokens: MintEntraTokens,
  options: { authorizationCode?: string } = {},
): Promise<ProviderTraffic> {
  const code = options.authorizationCode ?? "demo-authorization-code";
  const traffic: ProviderTraffic = { authorizations: [], tokenRequests: [] };

  await page
    .context()
    .route(`${entraEndpoints(tenantId).authorize}*`, (route) => {
      const params = new URL(route.request().url()).searchParams;
      traffic.authorizations.push(params);

      const callback = new URL(params.get("redirect_uri") ?? "");
      callback.searchParams.set("code", code);
      callback.searchParams.set("state", params.get("state") ?? "");
      callback.searchParams.set("session_state", "demo-session-state");

      return route.fulfill({
        status: 302,
        headers: { location: callback.toString() },
        body: "",
      });
    });

  await page
    .context()
    .route("**/api/oauth/entra/exchange-token", async (route) => {
      const exchangeRequest = (route.request().postDataJSON() ?? {}) as Record<
        string,
        unknown
      >;

      const body = await mintTokens({
        authorization: traffic.authorizations.at(-1) ?? new URLSearchParams(),
        exchangeRequest,
      });

      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      });
    });

  return traffic;
}

/** Answers a protected API with a fixed JSON document. */
export async function stubProtectedApi(page: Page, url: string, body: unknown) {
  await page.context().route(url, (route) =>
    route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),
  );
}
