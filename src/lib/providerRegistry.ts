export type ProviderAppId = "entra" | "auth0";

export type ProviderFlowId =
  | "authorization-code-public-client"
  | "authorization-code-confidential-client"
  | "client-credentials";

export type ProviderMenuGroupId = "home" | "public" | "confidential" | "tools";

export type ProviderFlowRoute = {
  id: ProviderFlowId;
  group: Exclude<ProviderMenuGroupId, "home" | "tools">;
  labelKey: string;
  icon: string;
  pathSuffix: string;
};

export type ProviderApp = {
  id: ProviderAppId;
  labelKey: string;
  basePath: `/${ProviderAppId}`;
  landingPath: `/${ProviderAppId}`;
  flows: ProviderFlowRoute[];
};

export const DEFAULT_PROVIDER_APP_ID: ProviderAppId = "entra";

export const PROVIDER_APP_IDS: ProviderAppId[] = ["entra", "auth0"];

export const PROVIDER_FLOW_ROUTES: ProviderFlowRoute[] = [
  {
    id: "authorization-code-public-client",
    group: "public",
    labelKey: "AuthorizationCodeFlow",
    icon: "pi pi-fw pi-desktop",
    pathSuffix: "/authorization-code/public-client",
  },
  {
    id: "authorization-code-confidential-client",
    group: "confidential",
    labelKey: "AuthorizationCodeFlow",
    icon: "pi pi-fw pi-server",
    pathSuffix: "/authorization-code/confidential-client",
  },
  {
    id: "client-credentials",
    group: "confidential",
    labelKey: "ClientCredentialsFlow",
    icon: "pi pi-fw pi-key",
    pathSuffix: "/client-credentials",
  },
];

export const PROVIDER_APPS: Record<ProviderAppId, ProviderApp> = {
  entra: {
    id: "entra",
    labelKey: "Entra",
    basePath: "/entra",
    landingPath: "/entra",
    flows: PROVIDER_FLOW_ROUTES,
  },
  auth0: {
    id: "auth0",
    labelKey: "Auth0",
    basePath: "/auth0",
    landingPath: "/auth0",
    flows: PROVIDER_FLOW_ROUTES,
  },
};

const LOCALE_SEGMENTS = new Set(["en", "de"]);

export function isProviderAppId(
  value: string | undefined,
): value is ProviderAppId {
  return value === "entra" || value === "auth0";
}

export function normalizePathname(pathname: string): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const withoutTrailingSlash = normalized.replace(/\/$/, "");
  return withoutTrailingSlash || "/";
}

function getPathSegments(pathname: string): string[] {
  return normalizePathname(pathname).split("/").filter(Boolean);
}

export function getRouteProvider(pathname: string): ProviderAppId | null {
  const segments = getPathSegments(pathname);
  const first = segments[0];
  const maybeProvider = LOCALE_SEGMENTS.has(first) ? segments[1] : first;
  return isProviderAppId(maybeProvider) ? maybeProvider : null;
}

export function getRoutePathWithoutProvider(pathname: string): string {
  const segments = getPathSegments(pathname);
  const startsWithLocale = LOCALE_SEGMENTS.has(segments[0]);
  const providerIndex = startsWithLocale ? 1 : 0;

  if (!isProviderAppId(segments[providerIndex])) {
    return normalizePathname(pathname);
  }

  const suffixSegments = segments.slice(providerIndex + 1);
  return suffixSegments.length ? `/${suffixSegments.join("/")}` : "/";
}

export function getProviderRoutePath(
  providerId: ProviderAppId,
  pathSuffix: string,
): string {
  const suffix = normalizePathname(pathSuffix);
  return suffix === "/"
    ? PROVIDER_APPS[providerId].basePath
    : `${PROVIDER_APPS[providerId].basePath}${suffix}`;
}

export function getProviderSwitchTarget(
  pathname: string,
  providerId: ProviderAppId,
): string {
  const currentProvider = getRouteProvider(pathname);
  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPathname.startsWith("/tools")) {
    return normalizedPathname;
  }

  if (!currentProvider) {
    return PROVIDER_APPS[providerId].landingPath;
  }

  const suffix = getRoutePathWithoutProvider(pathname);
  const supportedSuffixes = new Set([
    "/",
    ...PROVIDER_APPS[providerId].flows.map((flow) => flow.pathSuffix),
  ]);

  if (!supportedSuffixes.has(suffix)) {
    return PROVIDER_APPS[providerId].landingPath;
  }

  return getProviderRoutePath(providerId, suffix);
}

export function getLegacyEntraRedirect(pathSuffix: string): string {
  return getProviderRoutePath("entra", pathSuffix);
}
