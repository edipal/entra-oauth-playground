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
      .map(([key, paramValue]) => [key, String(paramValue ?? "").trim()])
      .filter(([, paramValue]) => !!paramValue),
  );
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
      issuerUrl ? String(issuerUrl) : undefined,
    );

    if (
      !clientId ||
      !privateKeyPem ||
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
      ...validatedParams,
      client_id: String(clientId),
      redirect_uri: normalizedParams.redirect_uri,
      response_type: normalizedParams.response_type,
    };

    const requestObject = await buildAuthorizationRequestObject({
      audience,
      clientId: String(clientId),
      privateKeyPem: String(privateKeyPem),
      kid: kid ? String(kid) : undefined,
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
