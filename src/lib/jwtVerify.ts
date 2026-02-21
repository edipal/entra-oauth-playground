import {
  createRemoteJWKSet,
  jwtVerify,
  decodeProtectedHeader,
  decodeJwt,
  exportSPKI,
  type JWTPayload,
} from "jose";

export type VerifyResult = {
  ok: boolean;
  keyFound: boolean;
  error?: string;
  reason?: string;
  alg?: string;
  kid?: string;
  ver?: string;
  iss?: string;
  publicKeyPem?: string;
};

export const buildMetadataUrl = (iss?: string) => {
  if (!iss) return "";
  try {
    const base = iss.endsWith("/") ? iss.slice(0, -1) : iss;
    return `${base}/.well-known/openid-configuration`;
  } catch {
    return "";
  }
};

export const guessJwksUrl = (iss?: string, tid?: string, ver?: string) => {
  if (!iss) return "";
  try {
    const u = new URL(iss);
    const host = u.host.toLowerCase();
    const tenant = (tid || "common").trim();
    const v = (ver || (iss.includes("/v2.0") ? "2.0" : "1.0")).startsWith("2")
      ? "v2.0"
      : "v1.0";
    const isAllowedHost = (h: string, domain: string) =>
      h === domain || h.endsWith("." + domain);
    if (
      isAllowedHost(host, "login.microsoftonline.com") ||
      isAllowedHost(host, "sts.windows.net")
    ) {
      return `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`;
    }
  } catch {}
  const meta = buildMetadataUrl(iss);
  return `${meta} -> jwks_uri`;
};

export async function verifyJwtSignature(
  token: string,
  jwksUrl: string,
  expectedKid?: string,
): Promise<VerifyResult> {
  try {
    // Decode header and payload for metadata (even if verification fails)
    const header = decodeProtectedHeader(token);
    const payload = decodeJwt(token) as JWTPayload & {
      tid?: string;
      ver?: string;
    };

    const alg = header.alg;
    const kid = header.kid;
    const ver = payload.ver;
    const iss = payload.iss;

    // Create JWKS getter
    const JWKS = createRemoteJWKSet(new URL(jwksUrl));

    // Attempt verification
    const { protectedHeader, payload: verifiedPayload } = await jwtVerify(
      token,
      JWKS,
      {
        algorithms: ["RS256", "RS384", "RS512"], // Support common RSA algorithms
      },
    );

    // Verification succeeded
    return {
      ok: true,
      keyFound: true,
      alg: protectedHeader.alg,
      kid: protectedHeader.kid,
      ver: (verifiedPayload as any).ver,
      iss: verifiedPayload.iss,
    };
  } catch (e: any) {
    // Try to extract as much info as possible even on failure
    try {
      const header = decodeProtectedHeader(token);
      const payload = decodeJwt(token) as JWTPayload & {
        tid?: string;
        ver?: string;
      };

      const errorMsg = String(e.message || e);
      const isKeyNotFound =
        errorMsg.includes("kid") ||
        errorMsg.includes("key") ||
        errorMsg.includes("JWK");

      return {
        ok: false,
        keyFound: !isKeyNotFound,
        error: errorMsg,
        reason: isKeyNotFound
          ? "Key not found or signature mismatch"
          : "Verification failed",
        alg: header.alg,
        kid: header.kid,
        ver: payload.ver,
        iss: payload.iss,
      };
    } catch {
      // Couldn't even decode the token
      return {
        ok: false,
        keyFound: false,
        error: String(e.message || e),
        reason: "Invalid JWT format",
      };
    }
  }
}
