import {
  createRemoteJWKSet,
  compactVerify,
  decodeProtectedHeader,
  decodeJwt,
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

/**
 * What went wrong, taken from jose's own error code rather than guessed from the
 * message text. Sniffing for "key" or "kid" in a message put an expired token —
 * whose message mentions neither — in the same bucket as a real failure.
 */
export function describeFailure(code: string | undefined): {
  keyFound: boolean;
  reason: string;
} {
  switch (code) {
    case "ERR_JWKS_NO_MATCHING_KEY":
      return { keyFound: false, reason: "No matching key in the JWKS" };
    case "ERR_JWKS_MULTIPLE_MATCHING_KEYS":
      // Several keys fit the header, so jose refuses to guess. The key is there;
      // what is missing is a `kid` narrow enough to pick it out.
      return {
        keyFound: true,
        reason: "More than one key in the JWKS matches this token",
      };
    case "ERR_JWKS_TIMEOUT":
    case "ERR_JWKS_INVALID":
      return { keyFound: false, reason: "Could not fetch the JWKS" };
    case "ERR_JWS_SIGNATURE_VERIFICATION_FAILED":
      return { keyFound: true, reason: "Signature does not match the key" };
    case "ERR_JOSE_ALG_NOT_ALLOWED":
      return { keyFound: true, reason: "Signing algorithm is not accepted" };
    case "ERR_JWS_INVALID":
    case "ERR_JWT_INVALID":
      return { keyFound: false, reason: "Invalid JWT format" };
    default:
      return { keyFound: false, reason: "Verification failed" };
  }
}

/**
 * Verifies the signature and nothing else.
 *
 * `exp` and `nbf` are deliberately not checked here. jose's `jwtVerify` folds them
 * in, which made an expired-but-correctly-signed token come back as a signature
 * failure — and disagreed with the Validate step's own claim list, which allows
 * 300 seconds of clock skew where jose allows none. Time claims belong to that
 * list; this function answers only "did the published key sign this token".
 */
export async function verifyJwtSignature(
  token: string,
  jwksUrl: string,
  expectedKid?: string,
): Promise<VerifyResult> {
  try {
    const JWKS = createRemoteJWKSet(new URL(jwksUrl));

    const { protectedHeader } = await compactVerify(token, JWKS, {
      algorithms: ["RS256", "RS384", "RS512"], // Support common RSA algorithms
    });
    const payload = decodeJwt(token);

    return {
      ok: true,
      keyFound: true,
      alg: protectedHeader.alg,
      kid: protectedHeader.kid,
      ver: typeof payload.ver === "string" ? payload.ver : undefined,
      iss: payload.iss,
    };
  } catch (e: unknown) {
    const error = e as { message?: string; code?: string };
    const errorMsg = String(error?.message || e);
    const { keyFound, reason } = describeFailure(error?.code);

    // Report as much of the token as it can still be read from, so the step can
    // show which key id and algorithm were attempted.
    try {
      const header = decodeProtectedHeader(token);
      const payload = decodeJwt(token);

      return {
        ok: false,
        keyFound,
        error: errorMsg,
        reason,
        alg: header.alg,
        kid: header.kid,
        ver: typeof payload.ver === "string" ? payload.ver : undefined,
        iss: payload.iss,
      };
    } catch {
      // Couldn't even decode the token
      return {
        ok: false,
        keyFound: false,
        error: errorMsg,
        reason: "Invalid JWT format",
      };
    }
  }
}
