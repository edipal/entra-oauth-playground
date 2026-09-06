import { decodeJwt as joseDecodeJwt, decodeProtectedHeader } from "jose";

/**
 * `opaque` is a normal outcome, not a failure: Auth0 issues an opaque access
 * token whenever the authorization request names no API audience, and such a
 * token has no inside to show. `invalid` is reserved for something that presents
 * itself as a compact JWS or JWE and then does not decode.
 */
export type DecodedTokenFormat = "jwt" | "jwe" | "opaque" | "invalid";

export type DecodedToken = {
  header: string;
  payload: string;
  format: DecodedTokenFormat;
};

const EMPTY_DECODED_TOKEN: DecodedToken = {
  header: "",
  payload: "",
  format: "invalid",
};

const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]*$/;

/**
 * Whether the token claims the shape of a compact JWS (exactly three segments) or
 * a compact JWE (exactly five). A token that does not even claim this shape was
 * never a JWT, so failing to decode it says nothing is wrong — only that there is
 * nothing to decode.
 *
 * Counted rather than matched with one repetition range: `{2,4}` dots also
 * accepted a four-segment token, which is neither serialization.
 */
const isCompactSerialization = (token: string): boolean => {
  const segments = token.split(".");
  if (segments.length !== 3 && segments.length !== 5) return false;
  return (
    segments[0].length > 0 &&
    segments.every((segment) => BASE64URL_SEGMENT.test(segment))
  );
};

export const decodeJwt = (token: string): DecodedToken => {
  const normalizedToken = token.trim();
  if (!normalizedToken) return EMPTY_DECODED_TOKEN;

  try {
    const header = decodeProtectedHeader(normalizedToken);
    const serializedHeader = JSON.stringify(header, null, 2);

    if (
      normalizedToken.split(".").length === 5 ||
      typeof header.enc === "string"
    ) {
      return {
        header: serializedHeader,
        payload: "",
        format: "jwe",
      };
    }

    const payload = joseDecodeJwt(normalizedToken);
    return {
      header: serializedHeader,
      payload: JSON.stringify(payload, null, 2),
      format: "jwt",
    };
  } catch {
    return {
      header: "",
      payload: "",
      format: isCompactSerialization(normalizedToken) ? "invalid" : "opaque",
    };
  }
};
