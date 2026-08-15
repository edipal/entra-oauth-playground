import type { IdentityProviderId } from "@/lib/identityProvider";

export type ClaimRow = {
  name: string;
  value: string;
  description: string;
};

// Claim descriptions are stored per provider: a shared layer of standard JWT/OIDC
// claims plus a provider overlay for the vendor-specific ones.
export type ClaimDescriptionGroups = Partial<
  Record<"common" | IdentityProviderId, Record<string, string>>
>;

export const ACCESS_CLAIMS_DOC =
  "https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference";
export const ID_CLAIMS_DOC =
  "https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference";
export const OPTIONAL_CLAIMS_DOC =
  "https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims-reference";
export const AUTH0_TOKENS_DOC = "https://auth0.com/docs/secure/tokens";
export const JWT_REGISTERED_CLAIMS_DOC =
  "https://datatracker.ietf.org/doc/html/rfc7519#section-4.1";
export const IANA_JWT_CLAIMS_DOC =
  "https://www.iana.org/assignments/jwt/jwt.xhtml";

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

export function resolveClaimDescriptions(
  groups: ClaimDescriptionGroups,
  providerId: IdentityProviderId,
): Record<string, string> {
  return { ...(groups.common ?? {}), ...(groups[providerId] ?? {}) };
}

// Providers let tenants add custom claims under a URI namespace, for example an
// Auth0 action or an Entra claims mapping policy.
export function isNamespacedClaim(name: string): boolean {
  return /^https?:\/\//i.test(name);
}

export function parsePayloadToClaims(
  payload: string,
  localizedDescriptions: Record<string, string>,
  fallbackDescription: string,
  namespacedDescription?: string,
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
        description:
          localizedDescriptions[name] ||
          (namespacedDescription && isNamespacedClaim(name)
            ? namespacedDescription
            : fallbackDescription),
      }),
    );
  } catch {
    return [];
  }
}
