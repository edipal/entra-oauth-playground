import { NextResponse } from "next/server";
import { buildClientAssertion } from "@/lib/jwtSign";
import { resolveAndValidateTokenEndpoint } from "@/lib/tokenEndpoint";
import {
  getClientAssertionAudience,
  type IdentityProviderId,
} from "@/lib/identityProvider";

// Shared server-side token endpoint calls for the provider routes under
// /api/oauth/<provider>/. The provider is always supplied by the route itself,
// never by the request body, so callers cannot choose the trust rules.

const CACHE_HEADERS = { "cache-control": "no-store" };

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: CACHE_HEADERS });
}

async function forwardTokenResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const text = isJson
    ? JSON.stringify(await response.json(), null, 2)
    : await response.text();

  const responseHeaders: Record<string, string> = {
    "content-type": isJson
      ? "application/json; charset=utf-8"
      : "text/plain; charset=utf-8",
    ...CACHE_HEADERS,
  };
  const dpopNonce = response.headers.get("dpop-nonce");
  if (dpopNonce) {
    responseHeaders["dpop-nonce"] = dpopNonce;
  }

  return new Response(text, {
    status: response.status,
    headers: responseHeaders,
  });
}

// Applies the requested client authentication to the token request body.
// Returns an error response when the required credential is missing.
async function applyClientAuthentication({
  body,
  providerId,
  issuerUrl,
  clientId,
  tokenEndpoint,
  clientAuthMethod,
  clientSecret,
  privateKeyPem,
  clientAssertionKid,
  clientAssertionX5t,
}: {
  body: URLSearchParams;
  providerId: IdentityProviderId;
  issuerUrl: unknown;
  clientId: string;
  tokenEndpoint: string;
  clientAuthMethod: unknown;
  clientSecret: unknown;
  privateKeyPem: unknown;
  clientAssertionKid: unknown;
  clientAssertionX5t: unknown;
}): Promise<NextResponse | null> {
  if (clientAuthMethod === "secret") {
    if (typeof clientSecret !== "string" || !clientSecret)
      return errorResponse("missing_client_secret");
    body.set("client_secret", clientSecret);
    return null;
  }

  if (clientAuthMethod === "certificate") {
    if (typeof privateKeyPem !== "string" || !privateKeyPem)
      return errorResponse("missing_private_key");

    const audience = getClientAssertionAudience(providerId, {
      issuerUrl: typeof issuerUrl === "string" ? issuerUrl : undefined,
      tokenEndpoint,
    });
    if (!audience) return errorResponse("invalid_client_assertion_audience");

    // Auth0 identifies the signing key by its own `kid`; an x5t here could only
    // be a stale Entra thumbprint, so it is never forwarded.
    const useX5t =
      providerId !== "auth0" &&
      typeof clientAssertionX5t === "string" &&
      !!clientAssertionX5t;

    const assertion = await buildClientAssertion({
      clientId,
      audience,
      privateKeyPem,
      x5t:
        useX5t && typeof clientAssertionX5t === "string"
          ? clientAssertionX5t
          : undefined,
      kid:
        typeof clientAssertionKid === "string" && clientAssertionKid
          ? clientAssertionKid
          : undefined,
      lifetimeSec: 60,
    });
    body.set(
      "client_assertion_type",
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    );
    body.set("client_assertion", assertion);
    return null;
  }

  return errorResponse("invalid_client_auth_method");
}

export async function handleExchangeTokenRequest(
  request: Request,
  providerId: IdentityProviderId,
) {
  try {
    const json = await request.json();
    const {
      tenantId,
      issuerUrl,
      clientId,
      redirectUri,
      authCode,
      scopes,
      audience,
      pkceEnabled,
      codeVerifier,
      clientAuthMethod,
      clientSecret,
      privateKeyPem,
      clientAssertionKid,
      clientAssertionX5t,
      tokenEndpoint,
      dpopProof,
    } = json || {};

    if (!clientId || !redirectUri || !authCode || !tokenEndpoint) {
      return errorResponse("missing_parameters");
    }

    // Auth0 rejects scope/audience on the code-for-token step; they belong on /authorize.
    const includeAuthCodeTokenExtras = providerId !== "auth0";
    const url = resolveAndValidateTokenEndpoint(tokenEndpoint, tenantId, {
      providerId,
      issuerUrl,
    });
    if (!url) {
      return errorResponse("invalid_token_endpoint");
    }

    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("client_id", String(clientId));
    body.set("code", String(authCode));
    body.set("redirect_uri", String(redirectUri));
    if (pkceEnabled && codeVerifier)
      body.set("code_verifier", String(codeVerifier));
    if (includeAuthCodeTokenExtras && scopes && String(scopes).trim())
      body.set("scope", String(scopes).trim());
    if (includeAuthCodeTokenExtras && audience && String(audience).trim())
      body.set("audience", String(audience).trim());

    const authError = await applyClientAuthentication({
      body,
      providerId,
      issuerUrl,
      clientId: String(clientId),
      tokenEndpoint: url,
      clientAuthMethod,
      clientSecret,
      privateKeyPem,
      clientAssertionKid,
      clientAssertionX5t,
    });
    if (authError) return authError;

    const headers: Record<string, string> = {
      "content-type": "application/x-www-form-urlencoded",
    };
    if (typeof dpopProof === "string" && dpopProof.trim()) {
      headers["DPoP"] = dpopProof.trim();
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: body.toString(),
      cache: "no-store",
    });

    return await forwardTokenResponse(response);
  } catch (error) {
    return NextResponse.json(
      { error: "exception", message: String(error) },
      { status: 500, headers: CACHE_HEADERS },
    );
  }
}

export async function handleClientCredentialsRequest(
  request: Request,
  providerId: IdentityProviderId,
) {
  try {
    const json = await request.json();
    const {
      tenantId,
      issuerUrl,
      clientId,
      scopes,
      audience,
      clientAuthMethod,
      clientSecret,
      privateKeyPem,
      clientAssertionKid,
      clientAssertionX5t,
      tokenEndpoint,
      dpopProof,
    } = json || {};

    const scopesText = scopes ? String(scopes).trim() : "";
    const audienceText = audience ? String(audience).trim() : "";

    if (!clientId || !tokenEndpoint) {
      return errorResponse("missing_parameters");
    }

    // Auth0 identifies the target API by audience; Entra expects a .default scope.
    if (providerId === "auth0" && !audienceText) {
      return errorResponse("missing_audience");
    }

    if (providerId !== "auth0" && !scopesText) {
      return errorResponse("missing_parameters");
    }

    const url = resolveAndValidateTokenEndpoint(tokenEndpoint, tenantId, {
      providerId,
      issuerUrl,
    });
    if (!url) {
      return errorResponse("invalid_token_endpoint");
    }

    const body = new URLSearchParams();
    body.set("grant_type", "client_credentials");
    body.set("client_id", String(clientId));
    if (scopesText) {
      body.set("scope", scopesText);
    }
    if (audienceText) {
      body.set("audience", audienceText);
    }

    const authError = await applyClientAuthentication({
      body,
      providerId,
      issuerUrl,
      clientId: String(clientId),
      tokenEndpoint: url,
      clientAuthMethod,
      clientSecret,
      privateKeyPem,
      clientAssertionKid,
      clientAssertionX5t,
    });
    if (authError) return authError;

    const headers: Record<string, string> = {
      "content-type": "application/x-www-form-urlencoded",
    };
    if (typeof dpopProof === "string" && dpopProof.trim()) {
      headers["DPoP"] = dpopProof.trim();
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: body.toString(),
      cache: "no-store",
    });

    return await forwardTokenResponse(response);
  } catch (error) {
    return NextResponse.json(
      { error: "exception", message: String(error) },
      { status: 500, headers: CACHE_HEADERS },
    );
  }
}
