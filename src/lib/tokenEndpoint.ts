import {
  getProviderExpectedTokenEndpoint,
  isAllowedProviderIssuer,
  isEntraProvider,
  normalizeIssuerUrl,
  normalizeProviderId,
} from "@/lib/identityProvider";

type TokenEndpointValidationOptions = {
  providerId?: unknown;
  issuerUrl?: unknown;
};

const stringifyPrimitive = (value: unknown): string => {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value).trim();
  }

  return "";
};

// Validate and normalize the token endpoint URL to prevent SSRF.
// Returns a fully resolved URL string with provider-specific safeguards, or null if invalid.
export function resolveAndValidateTokenEndpoint(
  tokenEndpoint: unknown,
  tenantId: unknown,
  options: TokenEndpointValidationOptions = {},
): string | null {
  const raw = stringifyPrimitive(tokenEndpoint);
  const tenant = stringifyPrimitive(tenantId);
  const providerId = normalizeProviderId(
    stringifyPrimitive(options.providerId),
  );

  if (!raw) {
    return null;
  }

  if (isEntraProvider(providerId) && !tenant) {
    return null;
  }

  const replaced = isEntraProvider(providerId)
    ? raw.replace("{tenant}", tenant)
    : raw;

  let url: URL;
  try {
    url = new URL(replaced);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") {
    return null;
  }

  const hostname = url.hostname.toLowerCase();

  if (!isEntraProvider(providerId)) {
    const issuer = normalizeIssuerUrl(stringifyPrimitive(options.issuerUrl));
    if (!issuer || !isAllowedProviderIssuer(providerId, issuer)) {
      return null;
    }

    const expectedTokenEndpoint = getProviderExpectedTokenEndpoint(
      providerId,
      issuer,
    );

    return url.toString() === expectedTokenEndpoint ? url.toString() : null;
  }

  const allowedHostSuffixes = [
    ".login.microsoftonline.com",
    ".sts.windows.net",
  ];

  const isAllowed = allowedHostSuffixes.some(
    (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix),
  );

  if (!isAllowed) {
    return null;
  }

  // Bind the endpoint to the tenant the request is configured for. The host check
  // above only proves the endpoint is Microsoft's — it says nothing about *which*
  // tenant, so a request configured for one tenant could be posted to another,
  // carrying the client secret or the signed assertion with it.
  //
  // The whole URL is not pinned the way the Auth0 branch pins it, because the
  // endpoint override exists so a user can reach the v1.0 shape (/oauth2/token)
  // as well as v2.0. Fixing the tenant segment allows that while refusing another
  // tenant. The tenant is always a GUID here — see isProviderConfigValid.
  const tenantSegment = url.pathname.split("/").find(Boolean);
  if (tenantSegment?.toLowerCase() !== tenant.toLowerCase()) {
    return null;
  }

  return url.toString();
}
