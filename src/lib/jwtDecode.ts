import { decodeJwt as joseDecodeJwt, decodeProtectedHeader } from "jose";

export type DecodedTokenFormat = "jwt" | "jwe" | "invalid";

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

export const decodeJwt = (token: string): DecodedToken => {
  try {
    const normalizedToken = token.trim();
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
    return EMPTY_DECODED_TOKEN;
  }
};
