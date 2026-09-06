import * as jose from "jose";

export interface DPoPKeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

export interface CreateDPoPProofParams {
  privateKey: CryptoKey;
  jwk: jose.JWK;
  htm: string;
  htu: string;
  ath?: string;
  nonce?: string;
}

/**
 * Generates an asymmetric ECDSA P-256 (ES256) key pair for DPoP.
 */
export async function generateDPoPKeyPair(): Promise<DPoPKeyPair> {
  const keyPair = await jose.generateKeyPair("ES256", {
    extractable: true,
  });
  return keyPair;
}

/**
 * Exports the public key to a clean JWK without private key parameters.
 */
export async function exportDPoPPublicJWK(
  publicKey: CryptoKey,
): Promise<jose.JWK> {
  const jwk = await jose.exportJWK(publicKey);
  const { kty, crv, x, y } = jwk;
  return { kty, crv, x, y };
}

/**
 * Calculates the canonical RFC 7638 SHA-256 JWK thumbprint (dpop_jkt).
 */
export async function calculateDPoPThumbprint(jwk: jose.JWK): Promise<string> {
  return jose.calculateJwkThumbprint(jwk, "sha256");
}

/**
 * Calculates the access token hash (ath) per RFC 9449 Section 4.1:
 * base64url(SHA-256(ASCII(accessToken)))
 */
export async function calculateAccessTokenHash(
  accessToken: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(accessToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return jose.base64url.encode(new Uint8Array(hashBuffer));
}

/**
 * Creates and signs a DPoP Proof JWT per RFC 9449 Section 4.2.
 */
export async function createDPoPProof({
  privateKey,
  jwk,
  htm,
  htu,
  ath,
  nonce,
}: CreateDPoPProofParams): Promise<string> {
  const normalizedHtu = htu.split("#")[0].split("?")[0];
  const jti = jose.base64url.encode(crypto.getRandomValues(new Uint8Array(16)));

  const payload: Record<string, unknown> = {
    htm: htm.toUpperCase(),
    htu: normalizedHtu,
    jti,
  };

  if (ath) {
    payload.ath = ath;
  }

  if (nonce) {
    payload.nonce = nonce;
  }

  return new jose.SignJWT(payload)
    .setProtectedHeader({
      typ: "dpop+jwt",
      alg: "ES256",
      jwk,
    })
    .setIssuedAt()
    .sign(privateKey);
}
