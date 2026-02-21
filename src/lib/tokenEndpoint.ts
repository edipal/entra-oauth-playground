// Validate and normalize the token endpoint URL to prevent SSRF.
// Returns a fully resolved URL string with the tenant substituted, or null if invalid.
export function resolveAndValidateTokenEndpoint(
  tokenEndpoint: unknown,
  tenantId: unknown,
): string | null {
  const raw = String(tokenEndpoint || "").trim();
  const tenant = String(tenantId || "").trim();
  if (!raw || !tenant) {
    return null;
  }

  const replaced = raw.replace("{tenant}", tenant);

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

  return url.toString();
}
