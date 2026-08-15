import { SignJWT, importPKCS8 } from "jose";
import { randomGuidLike } from "@/lib/random";

export type AuthorizationRequestObjectClaims = Record<string, string> & {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope?: string;
  state?: string;
  nonce?: string;
};

type BuildAuthorizationRequestObjectInput = {
  /**
   * The `aud` claim. For Auth0 this is the tenant URL *with* its trailing slash —
   * see `getAuth0TenantAudience`. Signing for the bare issuer instead is rejected
   * at /authorize with a bare 400.
   */
  audience: string;
  clientId: string;
  privateKeyPem: string;
  claims: AuthorizationRequestObjectClaims;
  kid?: string;
  lifetimeSec?: number;
};

export async function buildAuthorizationRequestObject({
  audience,
  clientId,
  privateKeyPem,
  claims,
  kid,
  lifetimeSec = 60,
}: BuildAuthorizationRequestObjectInput): Promise<string> {
  const privateKey = await importPKCS8(privateKeyPem, "RS256");
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + lifetimeSec;

  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "RS256", typ: "oauth-authz-req+jwt", kid })
    .setIssuer(clientId)
    .setAudience(audience)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .setJti(randomGuidLike())
    .sign(privateKey);
}
