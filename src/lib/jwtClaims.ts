export type ClaimRow = {
  name: string;
  value: string;
  description: string;
};

export const ACCESS_CLAIMS_DOC =
  "https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference";
export const ID_CLAIMS_DOC =
  "https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference";
export const OPTIONAL_CLAIMS_DOC =
  "https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims-reference";

function formatClaimValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable value]";
  }
}

export function parsePayloadToClaims(
  payload: string,
  localizedDescriptions: Record<string, string>,
  fallbackDescription: string,
): ClaimRow[] {
  if (!payload?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }

    return Object.entries(parsed as Record<string, unknown>).map(
      ([name, value]) => ({
        name,
        value: formatClaimValue(value),
        description: localizedDescriptions[name] || fallbackDescription,
      }),
    );
  } catch {
    return [];
  }
}