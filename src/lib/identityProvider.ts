import type { ClientAuthMethod } from "@/types/client-auth";

export type IdentityProviderId = "entra" | "auth0";

export type OAuthFlowKind = "authCode" | "clientCredentials";

export type OidcDiscoveryMetadata = {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  jwks_uri?: string;
  userinfo_endpoint?: string;
};

export type IdentityProviderPreset = {
  id: IdentityProviderId;
  supportsDiscovery: boolean;
  defaultScopes: Record<OAuthFlowKind, string>;
  defaultApiEndpoint: Record<OAuthFlowKind, string>;
  supportedClientAuthMethods: ClientAuthMethod[];
};

export const DEFAULT_PROVIDER_ID: IdentityProviderId = "entra";

export const ENTRA_AUTH_ENDPOINT_TEMPLATE =
  "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize";

export const ENTRA_TOKEN_ENDPOINT_TEMPLATE =
  "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token";

export const PROVIDER_IDS: IdentityProviderId[] = ["entra", "auth0"];

export const PROVIDER_PRESETS: Record<
  IdentityProviderId,
  IdentityProviderPreset
> = {
  entra: {
    id: "entra",
    supportsDiscovery: false,
    defaultScopes: {
      authCode: "openid profile offline_access",
      clientCredentials: "https://graph.microsoft.com/.default",
    },
    defaultApiEndpoint: {
      authCode: "https://graph.microsoft.com/v1.0/me",
      clientCredentials: "https://graph.microsoft.com/v1.0/users",
    },
    supportedClientAuthMethods: ["secret", "certificate"],
  },
  auth0: {
    id: "auth0",
    supportsDiscovery: true,
    defaultScopes: {
      authCode: "openid profile email offline_access",
      clientCredentials: "",
    },
    defaultApiEndpoint: {
      authCode: "",
      clientCredentials: "",
    },
    supportedClientAuthMethods: ["secret", "certificate"],
  },
};

const PROVIDER_ISSUER_HOST_SUFFIXES: Record<IdentityProviderId, string[]> = {
  entra: ["login.microsoftonline.com", "sts.windows.net"],
  auth0: ["auth0.com", "auth0app.com"],
};

export function getProviderPreset(providerId?: string): IdentityProviderPreset {
  if (providerId && providerId in PROVIDER_PRESETS) {
    return PROVIDER_PRESETS[providerId as IdentityProviderId];
  }

  return PROVIDER_PRESETS[DEFAULT_PROVIDER_ID];
}

export function normalizeProviderId(providerId?: string): IdentityProviderId {
  return getProviderPreset(providerId).id;
}

export function isEntraProvider(providerId?: string): boolean {
  return normalizeProviderId(providerId) === "entra";
}

export function normalizeIssuerUrl(issuerUrl?: string): string {
  const trimmed = (issuerUrl || "").trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return "";
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function isAllowedProviderIssuer(
  providerId?: string,
  issuerUrl?: string,
): boolean {
  const provider = normalizeProviderId(providerId);
  const issuer = normalizeIssuerUrl(issuerUrl);
  if (!issuer) return false;

  try {
    const hostname = new URL(issuer).hostname.toLowerCase();
    const allowedSuffixes = PROVIDER_ISSUER_HOST_SUFFIXES[provider];

    if (provider === "entra") {
      return allowedSuffixes.includes(hostname);
    }

    return allowedSuffixes.some((suffix) => hostname.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

export function getProviderExpectedTokenEndpoint(
  providerId?: string,
  issuerUrl?: string,
): string {
  const provider = normalizeProviderId(providerId);
  const issuer = normalizeIssuerUrl(issuerUrl);
  if (!issuer || !isAllowedProviderIssuer(provider, issuer)) return "";

  const parsedIssuer = new URL(issuer);

  if (provider === "auth0") {
    return new URL("/oauth/token", parsedIssuer.origin).toString();
  }

  return "";
}

export function getProviderExpectedParEndpoint(
  providerId?: string,
  issuerUrl?: string,
): string {
  const provider = normalizeProviderId(providerId);
  const issuer = normalizeIssuerUrl(issuerUrl);
  if (!issuer || !isAllowedProviderIssuer(provider, issuer)) return "";

  if (provider === "auth0") {
    return new URL("/oauth/par", new URL(issuer).origin).toString();
  }

  return "";
}

/**
 * The Auth0 tenant URL in the form Auth0 accepts as an audience: the issuer with
 * exactly one trailing slash. `normalizeIssuerUrl` strips it, so it is appended
 * back here.
 *
 * Both things this app signs for Auth0 — client assertions and JAR request
 * objects — are addressed to it, and Auth0 rejects a request object whose `aud`
 * lacks the slash (measured, not assumed). Keeping one function means the two
 * cannot drift apart.
 */
export function getAuth0TenantAudience(issuerUrl?: string): string {
  const issuer = normalizeIssuerUrl(issuerUrl);
  if (!issuer || !isAllowedProviderIssuer("auth0", issuer)) return "";
  return `${issuer}/`;
}

/**
 * The `aud` claim for a private_key_jwt client assertion.
 *
 * Providers disagree on what identifies them here. Entra expects the token
 * endpoint the assertion is sent to. Auth0 expects the tenant URL — it also
 * accepts the token endpoint, but the documented form is what is sent.
 */
export function getClientAssertionAudience(
  providerId: string | undefined,
  options: { issuerUrl?: string; tokenEndpoint?: string },
): string {
  const provider = normalizeProviderId(providerId);

  if (provider === "auth0") {
    return getAuth0TenantAudience(options.issuerUrl);
  }

  return (options.tokenEndpoint || "").trim();
}

export function buildProviderMetadataUrl(
  providerId?: string,
  issuerUrl?: string,
): string {
  const provider = getProviderPreset(providerId);
  if (!provider.supportsDiscovery) return "";

  const issuer = normalizeIssuerUrl(issuerUrl);
  if (!issuer || !isAllowedProviderIssuer(provider.id, issuer)) return "";

  return `${issuer}/.well-known/openid-configuration`;
}

export function resolveTemplateEndpoint(
  endpoint: string,
  tenantId?: string,
): string {
  const tenant = tenantId?.trim() || "{tenant}";
  return endpoint.replace("{tenant}", tenant);
}

export function resolveProviderAuthEndpoint({
  providerId,
  tenantId,
  metadata,
  endpointOverrideEnabled,
  authEndpointOverride,
}: {
  providerId?: string;
  tenantId?: string;
  metadata?: OidcDiscoveryMetadata | null;
  endpointOverrideEnabled?: boolean;
  authEndpointOverride?: string;
}): string {
  if (endpointOverrideEnabled && authEndpointOverride?.trim()) {
    return authEndpointOverride.trim();
  }

  if (isEntraProvider(providerId)) {
    return resolveTemplateEndpoint(ENTRA_AUTH_ENDPOINT_TEMPLATE, tenantId);
  }

  return metadata?.authorization_endpoint || "";
}

export function resolveProviderTokenEndpoint({
  providerId,
  tenantId,
  metadata,
  endpointOverrideEnabled,
  tokenEndpointOverride,
}: {
  providerId?: string;
  tenantId?: string;
  metadata?: OidcDiscoveryMetadata | null;
  endpointOverrideEnabled?: boolean;
  tokenEndpointOverride?: string;
}): string {
  if (endpointOverrideEnabled && tokenEndpointOverride?.trim()) {
    return tokenEndpointOverride.trim();
  }

  if (isEntraProvider(providerId)) {
    return resolveTemplateEndpoint(ENTRA_TOKEN_ENDPOINT_TEMPLATE, tenantId);
  }

  return metadata?.token_endpoint || "";
}

export function getProviderDefaultScopes(
  providerId: IdentityProviderId,
  flowKind: OAuthFlowKind,
): string {
  return PROVIDER_PRESETS[providerId].defaultScopes[flowKind];
}

export function getProviderDefaultApiEndpoint(
  providerId: IdentityProviderId,
  flowKind: OAuthFlowKind,
): string {
  return PROVIDER_PRESETS[providerId].defaultApiEndpoint[flowKind];
}

export function isValidGuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    value,
  );
}

export function isProviderConfigValid({
  providerId,
  tenantId,
  issuerUrl,
}: {
  providerId?: string;
  tenantId?: string;
  issuerUrl?: string;
}): boolean {
  if (isEntraProvider(providerId)) {
    return !!tenantId?.trim() && isValidGuid(tenantId.trim());
  }

  return isAllowedProviderIssuer(providerId, issuerUrl);
}

export function isClientIdValidForProvider(
  providerId: IdentityProviderId,
  clientId: string,
): boolean {
  if (providerId === "entra") {
    return isValidGuid(clientId);
  }

  return clientId.trim().length > 0;
}

export function getIssuerForValidation({
  providerId,
  tenantId,
  issuerUrl,
}: {
  providerId?: string;
  tenantId?: string;
  issuerUrl?: string;
}): string {
  if (isEntraProvider(providerId)) {
    return tenantId?.trim() || "";
  }

  return normalizeIssuerUrl(issuerUrl);
}

export function issuerMatchesExpected(
  issuer: string | undefined,
  expectedIssuer: string,
  providerId?: string,
): boolean {
  if (!issuer) return false;

  if (isEntraProvider(providerId)) {
    if (!expectedIssuer) return issuer.trim().length > 0;

    try {
      const parsedIssuer = new URL(issuer);
      const hostname = parsedIssuer.hostname.toLowerCase();
      const tenant = parsedIssuer.pathname.split("/").find(Boolean);

      return (
        PROVIDER_ISSUER_HOST_SUFFIXES.entra.includes(hostname) &&
        tenant?.toLowerCase() === expectedIssuer.toLowerCase()
      );
    } catch {
      return false;
    }
  }

  if (!expectedIssuer) return issuer.trim().length > 0;

  const normalizeForCompare = (value: string) =>
    value.trim().replace(/\/$/, "");
  return normalizeForCompare(issuer) === normalizeForCompare(expectedIssuer);
}
