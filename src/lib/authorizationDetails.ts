// Validation for the Rich Authorization Requests (RFC 9396) `authorization_details`
// parameter. The value is user-authored JSON, so it is validated before it reaches an
// authorization URL, a pushed authorization request, or a signed request object.

export const MAX_AUTHORIZATION_DETAILS_LENGTH = 4096;

// Bounds the parse work for untrusted input while still allowing generously
// indented JSON that stays within the compact limit once normalized.
const MAX_RAW_AUTHORIZATION_DETAILS_LENGTH =
  MAX_AUTHORIZATION_DETAILS_LENGTH * 4;

export type AuthorizationDetailsErrorKey =
  | "rarInvalidJson"
  | "rarNotArray"
  | "rarEmptyArray"
  | "rarEntryNotObject"
  | "rarEntryMissingType"
  | "rarTooLarge";

export type AuthorizationDetailsValidation =
  | { status: "empty" }
  | { status: "valid"; value: string }
  | { status: "invalid"; errorKey: AuthorizationDetailsErrorKey };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateAuthorizationDetails(
  rarJson?: string,
): AuthorizationDetailsValidation {
  const trimmed = (rarJson || "").trim();
  if (!trimmed) {
    return { status: "empty" };
  }

  if (trimmed.length > MAX_RAW_AUTHORIZATION_DETAILS_LENGTH) {
    return { status: "invalid", errorKey: "rarTooLarge" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { status: "invalid", errorKey: "rarInvalidJson" };
  }

  if (!Array.isArray(parsed)) {
    return { status: "invalid", errorKey: "rarNotArray" };
  }

  if (parsed.length === 0) {
    return { status: "invalid", errorKey: "rarEmptyArray" };
  }

  for (const entry of parsed) {
    if (!isPlainObject(entry)) {
      return { status: "invalid", errorKey: "rarEntryNotObject" };
    }

    if (typeof entry.type !== "string" || !entry.type.trim()) {
      return { status: "invalid", errorKey: "rarEntryMissingType" };
    }
  }

  const value = JSON.stringify(parsed);
  if (value.length > MAX_AUTHORIZATION_DETAILS_LENGTH) {
    return { status: "invalid", errorKey: "rarTooLarge" };
  }

  return { status: "valid", value };
}

// Server-side guard for request payloads that carry authorization parameters.
// Returns the params with a normalized `authorization_details` value, or null when
// the caller supplied something that is not a valid RAR payload.
export function normalizeAuthorizationDetailsParam<
  T extends Record<string, unknown>,
>(params: T): T | null {
  const raw = params.authorization_details;
  if (raw === undefined || raw === null) {
    return params;
  }
  if (typeof raw !== "string") {
    return null;
  }
  if (!raw.trim()) {
    return params;
  }

  const validation = validateAuthorizationDetails(raw);
  if (validation.status !== "valid") {
    return null;
  }

  return { ...params, authorization_details: validation.value };
}
