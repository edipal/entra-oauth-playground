import { NextResponse } from "next/server";
import { buildClientAssertion } from "@/lib/jwtSign";
import {
  getClientAssertionAudience,
  getProviderExpectedParEndpoint,
  isAllowedProviderIssuer,
} from "@/lib/identityProvider";
import { normalizeAuthorizationDetailsParam } from "@/lib/authorizationDetails";

const CACHE_HEADERS = { "cache-control": "no-store" };

type AuthorizationParams = Record<string, unknown>;

function appendAuthorizationParams(
  body: URLSearchParams,
  authorizationParams: AuthorizationParams,
) {
  for (const [key, value] of Object.entries(authorizationParams)) {
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      continue;
    }
    const text = String(value).trim();
    if (!text) continue;
    body.set(key, text);
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const {
      issuerUrl,
      authorizationParams,
      clientAuthMethod,
      clientSecret,
      privateKeyPem,
      clientAssertionKid,
    } = json || {};

    if (
      typeof issuerUrl !== "string" ||
      !isAllowedProviderIssuer("auth0", issuerUrl) ||
      !authorizationParams ||
      typeof authorizationParams !== "object" ||
      Array.isArray(authorizationParams)
    ) {
      return NextResponse.json(
        { error: "invalid_parameters" },
        { status: 400, headers: CACHE_HEADERS },
      );
    }

    const parEndpoint = getProviderExpectedParEndpoint("auth0", issuerUrl);
    if (!parEndpoint) {
      return NextResponse.json(
        { error: "invalid_par_endpoint" },
        { status: 400, headers: CACHE_HEADERS },
      );
    }

    const validatedParams = normalizeAuthorizationDetailsParam(
      authorizationParams as AuthorizationParams,
    );
    if (!validatedParams) {
      return NextResponse.json(
        { error: "invalid_authorization_details" },
        { status: 400, headers: CACHE_HEADERS },
      );
    }

    const body = new URLSearchParams();
    appendAuthorizationParams(body, validatedParams);

    if (clientAuthMethod === "secret") {
      if (typeof clientSecret !== "string" || !clientSecret) {
        return NextResponse.json(
          { error: "missing_client_secret" },
          { status: 400, headers: CACHE_HEADERS },
        );
      }
      body.set("client_secret", clientSecret);
    } else if (clientAuthMethod === "certificate") {
      if (
        typeof privateKeyPem !== "string" ||
        !privateKeyPem ||
        !body.get("client_id")
      ) {
        return NextResponse.json(
          { error: "missing_private_key" },
          { status: 400, headers: CACHE_HEADERS },
        );
      }
      // Auth0 wants the tenant URL as `aud`, not the endpoint being called, and
      // identifies the key by its own `kid` rather than a certificate thumbprint.
      const assertion = await buildClientAssertion({
        clientId: body.get("client_id")!,
        audience: getClientAssertionAudience("auth0", {
          issuerUrl,
        }),
        privateKeyPem,
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
    }

    const response = await fetch(parEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";
    const text = contentType.includes("application/json")
      ? JSON.stringify(await response.json(), null, 2)
      : await response.text();

    return new Response(text, {
      status: response.status,
      headers: {
        "content-type": contentType.includes("application/json")
          ? "application/json; charset=utf-8"
          : "text/plain; charset=utf-8",
        ...CACHE_HEADERS,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "exception", message: String(error) },
      { status: 500, headers: CACHE_HEADERS },
    );
  }
}
