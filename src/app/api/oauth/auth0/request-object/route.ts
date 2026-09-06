import { NextResponse } from "next/server";
import {
  buildAuthorizationRequestObject,
  type AuthorizationRequestObjectClaims,
} from "@/lib/requestObject";
import { getAuth0TenantAudience } from "@/lib/identityProvider";
import { normalizeAuthorizationDetailsParam } from "@/lib/authorizationDetails";

const CACHE_HEADERS = { "cache-control": "no-store" };

function normalizeAuthorizationParams(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([, paramValue]) =>
          typeof paramValue === "string" ||
          typeof paramValue === "number" ||
          typeof paramValue === "boolean",
      )
      .map(([key, paramValue]) => [key, String(paramValue).trim()])
      .filter(([, paramValue]) => !!paramValue),
  );
}

/**
 * Restores the JSON types the query string flattened away. The parameters arrive
 * as the authorize URL's search params, where everything is a string — correct
 * there, wrong in a JWT. RFC 9101 §4: "Parameter names and string values MUST be
 * included as JSON strings... Numerical values MUST be included as JSON numbers."
 *
 * Only the two parameters that have a non-string type are converted; the rest are
 * strings by definition and stay as they are.
 */
function applyJsonParameterTypes(
  params: Record<string, string>,
): Record<string, unknown> {
  const claims: Record<string, unknown> = { ...params };

  if (/^\d+$/.test(params.max_age ?? "")) {
    claims.max_age = Number(params.max_age);
  }

  if (params.authorization_details) {
    // Already validated as a well-formed array by normalizeAuthorizationDetailsParam,
    // so this reinstates the array rather than trusting arbitrary input.
    try {
      claims.authorization_details = JSON.parse(params.authorization_details);
    } catch {
      // leave the string in place rather than dropping the parameter
    }
  }

  return claims;
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { issuerUrl, clientId, authorizationParams, privateKeyPem, kid } =
      json || {};

    const normalizedParams = normalizeAuthorizationParams(authorizationParams);
    // Empty for anything outside the Auth0 issuer allowlist, so this doubles as
    // the issuer check.
    const audience = getAuth0TenantAudience(
      typeof issuerUrl === "string" ? issuerUrl : undefined,
    );

    if (
      typeof clientId !== "string" ||
      !clientId.trim() ||
      typeof privateKeyPem !== "string" ||
      !privateKeyPem.trim() ||
      !audience ||
      !normalizedParams.redirect_uri ||
      !normalizedParams.response_type
    ) {
      return NextResponse.json(
        { error: "invalid_parameters" },
        { status: 400, headers: CACHE_HEADERS },
      );
    }

    const validatedParams =
      normalizeAuthorizationDetailsParam(normalizedParams);
    if (!validatedParams) {
      return NextResponse.json(
        { error: "invalid_authorization_details" },
        { status: 400, headers: CACHE_HEADERS },
      );
    }

    const claims: AuthorizationRequestObjectClaims = {
      ...applyJsonParameterTypes(validatedParams),
      client_id: clientId,
      redirect_uri: normalizedParams.redirect_uri,
      response_type: normalizedParams.response_type,
    };

    const requestObject = await buildAuthorizationRequestObject({
      audience,
      clientId,
      privateKeyPem,
      kid: typeof kid === "string" && kid.trim() ? kid.trim() : undefined,
      claims,
      lifetimeSec: 60,
    });

    return NextResponse.json(
      { request: requestObject },
      { status: 200, headers: CACHE_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "exception", message: String(error) },
      { status: 500, headers: CACHE_HEADERS },
    );
  }
}
