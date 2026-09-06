import { SignJWT, importPKCS8 } from "jose";
import { randomGuidLike } from "./random";

export type ClientAssertionClaims = {
  iss: string;
  sub: string;
  aud: string;
  jti: string;
  iat: number;
  exp: number;
};

/**
 * Builds the claims for a client assertion (for preview purposes).
 *
 * `audience` is provider-specific — see `getClientAssertionAudience` in
 * identityProvider.ts. It is not always the token endpoint.
 */
export function buildClientAssertionClaims(params: {
  clientId: string;
  audience: string;
  lifetimeSec?: number;
}): ClientAssertionClaims {
  const { clientId, audience, lifetimeSec = 60 } = params;
  const now = Math.floor(Date.now() / 1000);

  return {
    iss: clientId,
    sub: clientId,
    aud: audience,
    jti: randomGuidLike(),
    iat: now,
    exp: now + lifetimeSec,
  };
}

/**
 * Builds and signs a client assertion JWT for OAuth 2.0 private_key_jwt authentication.
 *
 * @param params.audience - The `aud` claim, which is provider-specific: the token
 *   endpoint for Entra, the tenant URL with a trailing slash for Auth0. Use
 *   `getClientAssertionAudience` rather than passing an endpoint directly.
 * @param params.x5t - X.509 Certificate SHA-1 Thumbprint (base64url-encoded).
 *   - This is what Microsoft Entra ID uses to identify the certificate
 *   - Should be the base64url-encoded SHA-1 hash of the DER certificate
 * @param params.kid - Key ID. Entra reuses the SHA-1 thumbprint; Auth0 generates
 *   its own JWK thumbprint per credential and has no certificate involved.
 */
export async function buildClientAssertion(params: {
  clientId: string;
  audience: string;
  privateKeyPem: string;
  x5t?: string;
  kid?: string;
  lifetimeSec?: number;
}): Promise<string> {
  const {
    clientId,
    audience,
    privateKeyPem,
    x5t,
    kid,
    lifetimeSec = 60,
  } = params;

  // Import the private key using jose
  const privateKey = await importPKCS8(privateKeyPem, "RS256");

  // Build protected header with x5t (X.509 thumbprint) and optionally kid
  const protectedHeader: any = { alg: "RS256" };
  if (x5t) {
    protectedHeader.x5t = x5t;
  }
  if (kid) {
    protectedHeader.kid = kid;
  }

  // Build and sign the JWT
  const jwt = new SignJWT({
    iss: clientId,
    sub: clientId,
    aud: audience,
    jti: randomGuidLike(),
  })
    .setProtectedHeader(protectedHeader)
    .setIssuedAt()
    .setExpirationTime(`${lifetimeSec}s`);

  return await jwt.sign(privateKey);
}
