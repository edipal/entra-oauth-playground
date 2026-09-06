"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import type { ClientAuthMethod } from "@/types/client-auth";
import type { IdentityProviderId } from "@/lib/identityProvider";
import {
  ENTRA_AUTH_ENDPOINT_TEMPLATE,
  ENTRA_TOKEN_ENDPOINT_TEMPLATE,
  PROVIDER_PRESETS,
} from "@/lib/identityProvider";
import type { DPoPKeyPair } from "@/lib/dpop";
import type * as jose from "jose";
import { usePathname } from "@/navigation";
import {
  DEFAULT_PROVIDER_APP_ID,
  getRouteProvider,
  type ProviderAppId,
} from "@/lib/providerRegistry";

// Persisted configuration that users can edit and we keep across sessions
export type AuthRequestMode = "url" | "par" | "jar" | "par-jar";

export type AuthCodePublicClientConfig = {
  providerId?: IdentityProviderId;
  tenantId?: string;
  issuerUrl?: string;
  clientId?: string;
  redirectUri?: string;
  scopes?: string;
  audience?: string;
  apiEndpointUrl?: string;
  endpointOverrideEnabled?: boolean;
  authEndpointOverride?: string;
  tokenEndpointOverride?: string;
  authRequestMode?: AuthRequestMode;
  rarJson?: string;
  // Streamlined mode: auto-run steps and hide advanced fields in public client flow
  streamlined?: boolean;
  // PKCE (optional)
  pkceEnabled?: boolean;
  // DPoP (optional, RFC 9449)
  dpopEnabled?: boolean;
};

// Runtime (global for the flow) that should NOT be persisted to localStorage
export type AuthCodePublicClientRuntime = {
  // PKCE
  codeVerifier?: string;
  codeChallenge?: string;
  // DPoP (runtime, not persisted)
  dpopKeyPair?: DPoPKeyPair;
  dpopPublicJwk?: jose.JWK;
  dpopJkt?: string;
  serverDPoPNonce?: string;
  lastTokenDPoPProof?: string;
  lastApiDPoPProof?: string;
  // Endpoints (runtime, not persisted)
  authEndpoint?: string;
  tokenEndpoint?: string;
  // Request parameters
  stateParam?: string;
  nonce?: string;
  // Callback
  callbackUrl?: string;
  callbackBody?: string;
  authCode?: string;
  extractedState?: string;
  callbackValidated?: boolean;
  // Tokens
  accessToken?: string;
  idToken?: string;
};

// Confidential Client (Authorization Code) — persisted configuration
export type AuthCodeConfidentialClientConfig = {
  providerId?: IdentityProviderId;
  tenantId?: string;
  issuerUrl?: string;
  clientId?: string;
  redirectUri?: string;
  scopes?: string;
  audience?: string;
  apiEndpointUrl?: string;
  endpointOverrideEnabled?: boolean;
  authEndpointOverride?: string;
  tokenEndpointOverride?: string;
  authRequestMode?: AuthRequestMode;
  rarJson?: string;
  streamlined?: boolean;
  pkceEnabled?: boolean;
  dpopEnabled?: boolean;
  clientAuthMethod?: ClientAuthMethod;
  // Optional header kid for client assertion (certificate mode)
  clientAssertionKid?: string;
  // X.509 Certificate SHA-1 Thumbprint (base64url-encoded) for x5t JWT header
  clientAssertionX5t?: string;
};

// Confidential Client runtime state (not persisted)
export type AuthCodeConfidentialClientRuntime = {
  // PKCE (optional)
  codeVerifier?: string;
  codeChallenge?: string;
  // DPoP (runtime, not persisted)
  dpopKeyPair?: DPoPKeyPair;
  dpopPublicJwk?: jose.JWK;
  dpopJkt?: string;
  serverDPoPNonce?: string;
  lastTokenDPoPProof?: string;
  lastApiDPoPProof?: string;
  // Endpoints (runtime)
  authEndpoint?: string;
  tokenEndpoint?: string;
  // Request parameters
  stateParam?: string;
  nonce?: string;
  // Callback
  callbackUrl?: string;
  callbackBody?: string;
  authCode?: string;
  extractedState?: string;
  callbackValidated?: boolean;
  // Tokens
  accessToken?: string;
  idToken?: string;
  // Client authentication (runtime only)
  clientSecret?: string; // secret mode
  privateKeyPem?: string; // certificate mode
  publicKeyPem?: string; // certificate mode - public key
  certificatePem?: string; // optional, certificate mode
  thumbprintSha1?: string; // certificate thumbprint SHA-1
  thumbprintSha256?: string; // certificate thumbprint SHA-256
  thumbprintSha1Base64Url?: string; // certificate thumbprint SHA-1 base64url
  clientAssertion?: string; // last generated assertion (for preview)
  assertionClaims?: string; // preview of JWT claims
  testAssertion?: string; // test assertion JWT
  decodedAssertion?: string; // decoded test assertion
};

// Client Credentials — persisted configuration
export type ClientCredentialsConfig = {
  providerId?: IdentityProviderId;
  tenantId?: string;
  issuerUrl?: string;
  clientId?: string;
  scopes?: string;
  audience?: string;
  apiEndpointUrl?: string;
  endpointOverrideEnabled?: boolean;
  tokenEndpointOverride?: string;
  streamlined?: boolean;
  clientAuthMethod?: ClientAuthMethod;
  // Optional header kid for client assertion (certificate mode)
  clientAssertionKid?: string;
  // X.509 Certificate SHA-1 Thumbprint (base64url-encoded) for x5t JWT header
  clientAssertionX5t?: string;
  // No PKCE for this flow, but kept for StepSettings compatibility
  pkceEnabled?: boolean;
  dpopEnabled?: boolean;
};

// Client Credentials runtime state (not persisted)
export type ClientCredentialsRuntime = {
  // DPoP (runtime, not persisted)
  dpopKeyPair?: DPoPKeyPair;
  dpopPublicJwk?: jose.JWK;
  dpopJkt?: string;
  serverDPoPNonce?: string;
  lastTokenDPoPProof?: string;
  lastApiDPoPProof?: string;
  // Endpoints (runtime)
  tokenEndpoint?: string;
  // Tokens
  accessToken?: string;
  idToken?: string;
  // Client authentication (runtime only)
  clientSecret?: string; // secret mode
  privateKeyPem?: string; // certificate mode
  publicKeyPem?: string; // certificate mode - public key
  certificatePem?: string; // optional, certificate mode
  thumbprintSha1?: string; // certificate thumbprint SHA-1
  thumbprintSha256?: string; // certificate thumbprint SHA-256
  thumbprintSha1Base64Url?: string; // certificate thumbprint SHA-1 base64url
  clientAssertion?: string; // last generated assertion (for preview)
  assertionClaims?: string; // preview of JWT claims
  testAssertion?: string; // test assertion JWT
  decodedAssertion?: string; // decoded test assertion
};

export type Settings = {
  // Per-flow persisted config
  authCodePublicClient?: AuthCodePublicClientConfig;
  authCodeConfidentialClient?: AuthCodeConfidentialClientConfig;
  clientCredentials?: ClientCredentialsConfig;
};

type SettingsContextValue = {
  // Persisted app settings
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  // True after localStorage has been read and merged into settings
  hydrated: boolean;
  // Convenience accessors for the auth code public client config
  authCodePublicClientConfig: AuthCodePublicClientConfig;
  setAuthCodePublicClientConfig: (
    s:
      | Partial<AuthCodePublicClientConfig>
      | ((
          prev: AuthCodePublicClientConfig,
        ) => Partial<AuthCodePublicClientConfig>),
  ) => void;
  // Runtime (not persisted)
  authCodePublicClientRuntime: AuthCodePublicClientRuntime;
  setAuthCodePublicClientRuntime: (
    s:
      | Partial<AuthCodePublicClientRuntime>
      | ((
          prev: AuthCodePublicClientRuntime,
        ) => Partial<AuthCodePublicClientRuntime>),
  ) => void;
  resetAuthCodePublicClientRuntime: () => void;

  // Confidential client accessors
  authCodeConfidentialClientConfig: AuthCodeConfidentialClientConfig;
  setAuthCodeConfidentialClientConfig: (
    s:
      | Partial<AuthCodeConfidentialClientConfig>
      | ((
          prev: AuthCodeConfidentialClientConfig,
        ) => Partial<AuthCodeConfidentialClientConfig>),
  ) => void;
  authCodeConfidentialClientRuntime: AuthCodeConfidentialClientRuntime;
  setAuthCodeConfidentialClientRuntime: (
    s:
      | Partial<AuthCodeConfidentialClientRuntime>
      | ((
          prev: AuthCodeConfidentialClientRuntime,
        ) => Partial<AuthCodeConfidentialClientRuntime>),
  ) => void;
  resetAuthCodeConfidentialClientRuntime: () => void;

  // Client credentials accessors
  clientCredentialsConfig: ClientCredentialsConfig;
  setClientCredentialsConfig: (
    s:
      | Partial<ClientCredentialsConfig>
      | ((prev: ClientCredentialsConfig) => Partial<ClientCredentialsConfig>),
  ) => void;
  clientCredentialsRuntime: ClientCredentialsRuntime;
  setClientCredentialsRuntime: (
    s:
      | Partial<ClientCredentialsRuntime>
      | ((prev: ClientCredentialsRuntime) => Partial<ClientCredentialsRuntime>),
  ) => void;
  resetClientCredentialsRuntime: () => void;

  // "Erase everything": replaces a flow's persisted config with the provider
  // defaults. A replacement rather than a merge, so a field added later cannot
  // quietly survive the erase the way `authRequestMode` and `rarJson` did.
  resetAuthCodePublicClientConfig: () => void;
  resetAuthCodeConfidentialClientConfig: () => void;
  resetClientCredentialsConfig: () => void;
};

const defaultEntraAuthCodePublicClientConfig: AuthCodePublicClientConfig = {
  providerId: "entra",
  tenantId: "",
  issuerUrl: "",
  clientId: "",
  redirectUri: "",
  scopes: PROVIDER_PRESETS.entra.defaultScopes.authCode,
  audience: "",
  apiEndpointUrl: PROVIDER_PRESETS.entra.defaultApiEndpoint.authCode,
  endpointOverrideEnabled: false,
  authEndpointOverride: "",
  tokenEndpointOverride: "",
  authRequestMode: "url",
  rarJson: "",
  streamlined: false,
  pkceEnabled: true,
  dpopEnabled: false,
};

const defaultAuth0AuthCodePublicClientConfig: AuthCodePublicClientConfig = {
  providerId: "auth0",
  tenantId: "",
  issuerUrl: "",
  clientId: "",
  redirectUri: "",
  scopes: PROVIDER_PRESETS.auth0.defaultScopes.authCode,
  audience: "",
  apiEndpointUrl: PROVIDER_PRESETS.auth0.defaultApiEndpoint.authCode,
  endpointOverrideEnabled: false,
  authEndpointOverride: "",
  tokenEndpointOverride: "",
  authRequestMode: "url",
  rarJson: "",
  streamlined: false,
  pkceEnabled: true,
  dpopEnabled: false,
};

const defaultSettings: Settings = {
  authCodePublicClient: defaultEntraAuthCodePublicClientConfig,
  authCodeConfidentialClient: {
    providerId: "entra",
    tenantId: "",
    issuerUrl: "",
    clientId: "",
    redirectUri: "",
    scopes: PROVIDER_PRESETS.entra.defaultScopes.authCode,
    audience: "",
    apiEndpointUrl: PROVIDER_PRESETS.entra.defaultApiEndpoint.authCode,
    endpointOverrideEnabled: false,
    authEndpointOverride: "",
    tokenEndpointOverride: "",
    authRequestMode: "url",
    rarJson: "",
    streamlined: false,
    pkceEnabled: true,
    dpopEnabled: false,
    clientAuthMethod: "secret",
    clientAssertionKid: "",
    clientAssertionX5t: "",
  },
  clientCredentials: {
    providerId: "entra",
    tenantId: "",
    issuerUrl: "",
    clientId: "",
    scopes: PROVIDER_PRESETS.entra.defaultScopes.clientCredentials,
    audience: "",
    apiEndpointUrl: PROVIDER_PRESETS.entra.defaultApiEndpoint.clientCredentials,
    endpointOverrideEnabled: false,
    tokenEndpointOverride: "",
    streamlined: false,
    clientAuthMethod: "secret",
    clientAssertionKid: "",
    clientAssertionX5t: "",
    pkceEnabled: false,
    dpopEnabled: false,
  },
};

const defaultAuth0Settings: Settings = {
  authCodePublicClient: defaultAuth0AuthCodePublicClientConfig,
  authCodeConfidentialClient: {
    providerId: "auth0",
    tenantId: "",
    issuerUrl: "",
    clientId: "",
    redirectUri: "",
    scopes: PROVIDER_PRESETS.auth0.defaultScopes.authCode,
    audience: "",
    apiEndpointUrl: PROVIDER_PRESETS.auth0.defaultApiEndpoint.authCode,
    endpointOverrideEnabled: false,
    authEndpointOverride: "",
    tokenEndpointOverride: "",
    authRequestMode: "url",
    rarJson: "",
    streamlined: false,
    pkceEnabled: true,
    dpopEnabled: false,
    clientAuthMethod: "secret",
    clientAssertionKid: "",
    clientAssertionX5t: "",
  },
  clientCredentials: {
    providerId: "auth0",
    tenantId: "",
    issuerUrl: "",
    clientId: "",
    scopes: PROVIDER_PRESETS.auth0.defaultScopes.clientCredentials,
    audience: "",
    apiEndpointUrl: PROVIDER_PRESETS.auth0.defaultApiEndpoint.clientCredentials,
    endpointOverrideEnabled: false,
    tokenEndpointOverride: "",
    streamlined: false,
    clientAuthMethod: "secret",
    clientAssertionKid: "",
    clientAssertionX5t: "",
    pkceEnabled: false,
    dpopEnabled: false,
  },
};

type SettingsByProvider = Record<ProviderAppId, Settings>;

const defaultSettingsByProvider: SettingsByProvider = {
  entra: defaultSettings,
  auth0: defaultAuth0Settings,
};

const getDefaultSettingsForProvider = (providerId: ProviderAppId): Settings =>
  defaultSettingsByProvider[providerId];

const SETTINGS_STORAGE_PREFIX = "app:settings:";

const mergeProviderSettings = (
  providerId: ProviderAppId,
  persisted?: Partial<Settings>,
): Settings => {
  const defaults = getDefaultSettingsForProvider(providerId);

  return {
    authCodePublicClient: {
      ...defaults.authCodePublicClient!,
      ...persisted?.authCodePublicClient,
      providerId,
    },
    authCodeConfidentialClient: {
      ...defaults.authCodeConfidentialClient!,
      ...persisted?.authCodeConfidentialClient,
      providerId,
    },
    clientCredentials: {
      ...defaults.clientCredentials!,
      ...persisted?.clientCredentials,
      providerId,
    },
  };
};

const storageKeyForProvider = (providerId: ProviderAppId) =>
  `${SETTINGS_STORAGE_PREFIX}${providerId}`;

/**
 * Where settings lived before the workspace split, when Entra was the only
 * provider. Its shape is this same `Settings` object with the same three flow
 * keys — the workspace fields were added, none were renamed — so it migrates
 * into the Entra workspace through `mergeProviderSettings` unchanged.
 */
const LEGACY_SETTINGS_KEY = "app:settings";
const MIGRATED_SETTINGS_KEY = "app:settings:migrated";

/**
 * Moves a pre-workspace `app:settings` value onto the Entra workspace key, so
 * anyone upgrading from an earlier build does not arrive at an empty Settings
 * step with their configuration still in localStorage, unread.
 *
 * Runs before hydration reads the workspace keys, and only when the Entra key is
 * absent — a configured workspace always wins. The old value is renamed rather
 * than deleted, and renaming is also what stops this running twice.
 */
const migrateLegacySettings = () => {
  try {
    const legacy = localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!legacy) return;

    const entraKey = storageKeyForProvider("entra");
    if (localStorage.getItem(entraKey) === null) {
      localStorage.setItem(entraKey, legacy);
    }
    localStorage.setItem(MIGRATED_SETTINGS_KEY, legacy);
    localStorage.removeItem(LEGACY_SETTINGS_KEY);
  } catch {
    // Storage unavailable, or full: hydration carries on with what it can read.
  }
};

const readPersistedProviderSettings = (
  providerId: ProviderAppId,
): Settings | null => {
  const key = storageKeyForProvider(providerId);
  let raw: string | null = null;

  try {
    raw = localStorage.getItem(key);
  } catch {
    // Storage unavailable (private mode, blocked cookies): defaults stand.
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("settings must be an object");
    }
    return mergeProviderSettings(
      providerId,
      parsed as Partial<Settings>,
    );
  } catch {
    // Keep the unreadable value rather than letting the next edit in this
    // workspace overwrite it, and carry on with defaults for this provider
    // alone. Quarantine once: the original is removed so a later mount does
    // not overwrite the copy.
    //
    // An existing quarantine is never replaced. A workspace can go unreadable
    // a second time, and by then the surviving copy is the one worth keeping —
    // overwriting it would discard the only readable settings left.
    try {
      const quarantineKey = `${key}:corrupt`;
      if (localStorage.getItem(quarantineKey) === null) {
        localStorage.setItem(quarantineKey, raw);
      }
      localStorage.removeItem(key);
    } catch {
      // nothing further to do — defaults are already in place
    }
    return null;
  }
};

const defaultAuthCodePublicClientRuntime: AuthCodePublicClientRuntime = {
  codeVerifier: "",
  codeChallenge: "",
  dpopKeyPair: undefined,
  dpopPublicJwk: undefined,
  dpopJkt: "",
  serverDPoPNonce: "",
  lastTokenDPoPProof: "",
  lastApiDPoPProof: "",
  authEndpoint: ENTRA_AUTH_ENDPOINT_TEMPLATE,
  tokenEndpoint: ENTRA_TOKEN_ENDPOINT_TEMPLATE,
  stateParam: "",
  nonce: "",
  callbackUrl: "",
  callbackBody: "",
  authCode: "",
  extractedState: "",
  callbackValidated: false,
  accessToken: "",
  idToken: "",
};

const defaultAuthCodeConfidentialClientRuntime: AuthCodeConfidentialClientRuntime =
  {
    codeVerifier: "",
    codeChallenge: "",
    dpopKeyPair: undefined,
    dpopPublicJwk: undefined,
    dpopJkt: "",
    serverDPoPNonce: "",
    lastTokenDPoPProof: "",
    lastApiDPoPProof: "",
    authEndpoint: ENTRA_AUTH_ENDPOINT_TEMPLATE,
    tokenEndpoint: ENTRA_TOKEN_ENDPOINT_TEMPLATE,
    stateParam: "",
    nonce: "",
    callbackUrl: "",
    callbackBody: "",
    authCode: "",
    extractedState: "",
    callbackValidated: false,
    accessToken: "",
    idToken: "",
    clientSecret: "",
    privateKeyPem: "",
    publicKeyPem: "",
    certificatePem: "",
    thumbprintSha1: "",
    thumbprintSha256: "",
    thumbprintSha1Base64Url: "",
    clientAssertion: "",
    assertionClaims: "",
    testAssertion: "",
    decodedAssertion: "",
  };

const defaultClientCredentialsRuntime: ClientCredentialsRuntime = {
  dpopKeyPair: undefined,
  dpopPublicJwk: undefined,
  dpopJkt: "",
  serverDPoPNonce: "",
  lastTokenDPoPProof: "",
  lastApiDPoPProof: "",
  tokenEndpoint: ENTRA_TOKEN_ENDPOINT_TEMPLATE,
  accessToken: "",
  idToken: "",
  clientSecret: "",
  privateKeyPem: "",
  publicKeyPem: "",
  certificatePem: "",
  thumbprintSha1: "",
  thumbprintSha256: "",
  thumbprintSha1Base64Url: "",
  clientAssertion: "",
  assertionClaims: "",
  testAssertion: "",
  decodedAssertion: "",
};

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

export function SettingsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const routeProvider = getRouteProvider(pathname);
  const activeProviderId = routeProvider || DEFAULT_PROVIDER_APP_ID;

  // Persisted settings
  // Initialize with defaults for SSR consistency. We'll hydrate provider-scoped settings after mount.
  const [settingsState, setSettingsState] = useState<SettingsByProvider>(
    defaultSettingsByProvider,
  );
  const settings = settingsState[activeProviderId];
  const [hydrated, setHydrated] = useState(false);

  // After mount, read persisted provider-scoped settings (if any) and merge with defaults.
  //
  // Each workspace is read on its own. With a single try/catch around the whole
  // loop, one unparseable key — a half-written value from a closed tab, a manual
  // edit — skipped `setSettingsState` entirely, so *both* workspaces stayed at
  // defaults in memory. The other workspace's stored settings were then
  // overwritten by those defaults the first time anything in it was edited.
  useEffect(() => {
    if (globalThis.window === undefined) return;

    const next = { ...defaultSettingsByProvider };
    migrateLegacySettings();

    for (const providerId of ["entra", "auth0"] as const) {
      const restored = readPersistedProviderSettings(providerId);
      if (restored) {
        next[providerId] = restored;
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettingsState(next);
    setHydrated(true);
  }, []);

  // In-memory runtime for the current flow (not persisted)
  const [
    authCodePublicClientRuntimeState,
    setAuthCodePublicClientRuntimeState,
  ] = useState<AuthCodePublicClientRuntime>(defaultAuthCodePublicClientRuntime);
  const authCodePublicClientRuntime = authCodePublicClientRuntimeState;

  const [
    authCodeConfidentialClientRuntimeState,
    setAuthCodeConfidentialClientRuntimeState,
  ] = useState<AuthCodeConfidentialClientRuntime>(
    defaultAuthCodeConfidentialClientRuntime,
  );
  const authCodeConfidentialClientRuntime =
    authCodeConfidentialClientRuntimeState;

  const [clientCredentialsRuntimeState, setClientCredentialsRuntimeState] =
    useState<ClientCredentialsRuntime>(defaultClientCredentialsRuntime);
  const clientCredentialsRuntime = clientCredentialsRuntimeState;

  // Switching workspace must not carry one provider's in-flight run into the
  // other, so the runtime is cleared on a real provider change.
  //
  // Keyed on the provider the *route* names, not on `activeProviderId`. Routes
  // outside a workspace — /tools/jwt-decoder — name none, and the fallback to the
  // default made them read as a switch to Entra: opening the decoder to inspect a
  // token discarded the Auth0 run that produced it, silently.
  const lastRouteProviderRef = useRef<ProviderAppId | null>(null);
  useEffect(() => {
    if (!routeProvider) return;

    const previous = lastRouteProviderRef.current;
    lastRouteProviderRef.current = routeProvider;
    if (previous === null || previous === routeProvider) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthCodePublicClientRuntimeState(defaultAuthCodePublicClientRuntime);
    setAuthCodeConfidentialClientRuntimeState(
      defaultAuthCodeConfidentialClientRuntime,
    );
    setClientCredentialsRuntimeState(defaultClientCredentialsRuntime);
  }, [routeProvider]);

  const persist = useCallback((providerId: ProviderAppId, next: Settings) => {
    try {
      localStorage.setItem(
        storageKeyForProvider(providerId),
        JSON.stringify(next),
      );
    } catch {
      // ignore localStorage failures
    }
  }, []);

  const setSettings = useCallback(
    (s: Partial<Settings>) => {
      setSettingsState((prev) => {
        const current = prev[activeProviderId];
        const nextProviderSettings = mergeProviderSettings(activeProviderId, {
          ...current,
          ...s,
        });
        persist(activeProviderId, nextProviderSettings);
        return { ...prev, [activeProviderId]: nextProviderSettings };
      });
    },
    [activeProviderId, persist],
  );

  const setAuthCodePublicClientConfig: SettingsContextValue["setAuthCodePublicClientConfig"] =
    useCallback(
      (update) => {
        setSettingsState((prev) => {
          const current = prev[activeProviderId];
          const defaults = getDefaultSettingsForProvider(activeProviderId);
          const prevCfg =
            current.authCodePublicClient || defaults.authCodePublicClient!;
          const patch = typeof update === "function" ? update(prevCfg) : update;
          const nextCfg = {
            ...prevCfg,
            ...patch,
            providerId: activeProviderId,
          };
          const nextProviderSettings = {
            ...current,
            authCodePublicClient: nextCfg,
          };
          persist(activeProviderId, nextProviderSettings);
          return { ...prev, [activeProviderId]: nextProviderSettings };
        });
      },
      [activeProviderId, persist],
    );

  const setAuthCodePublicClientRuntime: SettingsContextValue["setAuthCodePublicClientRuntime"] =
    useCallback((update) => {
      setAuthCodePublicClientRuntimeState((prev) => {
        const patch = typeof update === "function" ? update(prev) : update;
        return { ...prev, ...patch };
      });
    }, []);

  const resetAuthCodePublicClientRuntime = useCallback(
    () =>
      setAuthCodePublicClientRuntimeState(defaultAuthCodePublicClientRuntime),
    [],
  );

  const authCodePublicClientConfig =
    settings.authCodePublicClient ||
    getDefaultSettingsForProvider(activeProviderId).authCodePublicClient!;

  // Confidential client setters
  const setAuthCodeConfidentialClientConfig: SettingsContextValue["setAuthCodeConfidentialClientConfig"] =
    useCallback(
      (update) => {
        setSettingsState((prev) => {
          const current = prev[activeProviderId];
          const defaults = getDefaultSettingsForProvider(activeProviderId);
          const prevCfg =
            current.authCodeConfidentialClient ||
            defaults.authCodeConfidentialClient!;
          const patch = typeof update === "function" ? update(prevCfg) : update;
          const nextCfg = {
            ...prevCfg,
            ...patch,
            providerId: activeProviderId,
          };
          const nextProviderSettings = {
            ...current,
            authCodeConfidentialClient: nextCfg,
          };
          persist(activeProviderId, nextProviderSettings);
          return { ...prev, [activeProviderId]: nextProviderSettings };
        });
      },
      [activeProviderId, persist],
    );

  const setAuthCodeConfidentialClientRuntime: SettingsContextValue["setAuthCodeConfidentialClientRuntime"] =
    useCallback((update) => {
      setAuthCodeConfidentialClientRuntimeState((prev) => {
        const patch = typeof update === "function" ? update(prev) : update;
        return { ...prev, ...patch };
      });
    }, []);

  const resetAuthCodeConfidentialClientRuntime = useCallback(
    () =>
      setAuthCodeConfidentialClientRuntimeState(
        defaultAuthCodeConfidentialClientRuntime,
      ),
    [],
  );

  const authCodeConfidentialClientConfig =
    settings.authCodeConfidentialClient ||
    getDefaultSettingsForProvider(activeProviderId).authCodeConfidentialClient!;

  // Client credentials setters
  const setClientCredentialsConfig: SettingsContextValue["setClientCredentialsConfig"] =
    useCallback(
      (update) => {
        setSettingsState((prev) => {
          const current = prev[activeProviderId];
          const defaults = getDefaultSettingsForProvider(activeProviderId);
          const prevCfg =
            current.clientCredentials || defaults.clientCredentials!;
          const patch = typeof update === "function" ? update(prevCfg) : update;
          const nextCfg = {
            ...prevCfg,
            ...patch,
            providerId: activeProviderId,
          };
          const nextProviderSettings = {
            ...current,
            clientCredentials: nextCfg,
          };
          persist(activeProviderId, nextProviderSettings);
          return { ...prev, [activeProviderId]: nextProviderSettings };
        });
      },
      [activeProviderId, persist],
    );

  const setClientCredentialsRuntime: SettingsContextValue["setClientCredentialsRuntime"] =
    useCallback((update) => {
      setClientCredentialsRuntimeState((prev) => {
        const patch = typeof update === "function" ? update(prev) : update;
        return { ...prev, ...patch };
      });
    }, []);

  const resetClientCredentialsRuntime = useCallback(
    () => setClientCredentialsRuntimeState(defaultClientCredentialsRuntime),
    [],
  );

  const clientCredentialsConfig =
    settings.clientCredentials ||
    getDefaultSettingsForProvider(activeProviderId).clientCredentials!;

  /**
   * Puts one flow's persisted config back to the provider defaults, replacing it
   * rather than merging into it.
   *
   * "Erase everything" used to hand the merging setter an object listing every
   * field it meant to clear. Any field missing from that list survived — which is
   * what happened to `authRequestMode` and `rarJson`, leaving an erased flow still
   * set to PAR + JAR with rich authorization details attached. Reading the
   * defaults instead means a field added later is covered without anyone
   * remembering to extend a list.
   */
  const resetFlowConfig = useCallback(
    (flowKey: keyof Settings) => {
      setSettingsState((prev) => {
        const defaults = getDefaultSettingsForProvider(activeProviderId);
        const nextProviderSettings: Settings = {
          ...prev[activeProviderId],
          [flowKey]: { ...defaults[flowKey], providerId: activeProviderId },
        };
        persist(activeProviderId, nextProviderSettings);
        return { ...prev, [activeProviderId]: nextProviderSettings };
      });
    },
    [activeProviderId, persist],
  );

  const resetAuthCodePublicClientConfig = useCallback(
    () => resetFlowConfig("authCodePublicClient"),
    [resetFlowConfig],
  );
  const resetAuthCodeConfidentialClientConfig = useCallback(
    () => resetFlowConfig("authCodeConfidentialClient"),
    [resetFlowConfig],
  );
  const resetClientCredentialsConfig = useCallback(
    () => resetFlowConfig("clientCredentials"),
    [resetFlowConfig],
  );

  const value: SettingsContextValue = useMemo(
    () => ({
      settings,
      setSettings,
      hydrated,
      authCodePublicClientConfig,
      setAuthCodePublicClientConfig,
      authCodePublicClientRuntime,
      setAuthCodePublicClientRuntime,
      resetAuthCodePublicClientRuntime,
      authCodeConfidentialClientConfig,
      setAuthCodeConfidentialClientConfig,
      authCodeConfidentialClientRuntime,
      setAuthCodeConfidentialClientRuntime,
      resetAuthCodeConfidentialClientRuntime,
      clientCredentialsConfig,
      setClientCredentialsConfig,
      clientCredentialsRuntime,
      setClientCredentialsRuntime,
      resetClientCredentialsRuntime,
      resetAuthCodePublicClientConfig,
      resetAuthCodeConfidentialClientConfig,
      resetClientCredentialsConfig,
    }),
    [
      settings,
      setSettings,
      hydrated,
      authCodePublicClientConfig,
      setAuthCodePublicClientConfig,
      authCodePublicClientRuntime,
      setAuthCodePublicClientRuntime,
      resetAuthCodePublicClientRuntime,
      authCodeConfidentialClientConfig,
      setAuthCodeConfidentialClientConfig,
      authCodeConfidentialClientRuntime,
      setAuthCodeConfidentialClientRuntime,
      resetAuthCodeConfidentialClientRuntime,
      clientCredentialsConfig,
      setClientCredentialsConfig,
      clientCredentialsRuntime,
      setClientCredentialsRuntime,
      resetClientCredentialsRuntime,
      resetAuthCodePublicClientConfig,
      resetAuthCodeConfidentialClientConfig,
      resetClientCredentialsConfig,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
