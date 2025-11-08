import { SignJWT, importPKCS8 } from 'jose';
import { randomGuidLike } from './random';

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
 */
export function buildClientAssertionClaims(params: {
  clientId: string;
  tokenEndpoint: string;
  lifetimeSec?: number;
}): ClientAssertionClaims {
  const { clientId, tokenEndpoint, lifetimeSec = 60 } = params;
  const now = Math.floor(Date.now() / 1000);
  
  return {
    iss: clientId,
    sub: clientId,
    aud: tokenEndpoint,
    jti: randomGuidLike(),
    iat: now,
    exp: now + lifetimeSec,
  };
}

/**
 * Builds and signs a client assertion JWT for OAuth 2.0 private_key_jwt authentication.
 * 
 * @param params.x5t - X.509 Certificate SHA-1 Thumbprint (base64url-encoded).
 *   - This is what Microsoft Entra ID uses to identify the certificate
 *   - Should be the base64url-encoded SHA-1 hash of the DER certificate
 * @param params.kid - Optional Key ID for backward compatibility (uses same value as x5t)
 */
export async function buildClientAssertion(params: {
  clientId: string;
  tokenEndpoint: string;
  privateKeyPem: string;
  x5t?: string;
  kid?: string;
  lifetimeSec?: number;
}): Promise<string> {
  const { clientId, tokenEndpoint, privateKeyPem, x5t, kid, lifetimeSec = 60 } = params;
  
  // Import the private key using jose
  const privateKey = await importPKCS8(privateKeyPem, 'RS256');
  
  // Build protected header with x5t (X.509 thumbprint) and optionally kid
  const protectedHeader: any = { alg: 'RS256' };
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
    aud: tokenEndpoint,
    jti: randomGuidLike(),
  })
    .setProtectedHeader(protectedHeader)
    .setIssuedAt()
    .setExpirationTime(`${lifetimeSec}s`);
  
  return await jwt.sign(privateKey);
}
