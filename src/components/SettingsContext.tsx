"use client";
import React, {
  createContext,
  useContext,
  useEffect,
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
};

// Runtime (global for the flow) that should NOT be persisted to localStorage
export type AuthCodePublicClientRuntime = {
  // PKCE
  codeVerifier?: string;
  codeChallenge?: string;
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
};

// Client Credentials runtime state (not persisted)
export type ClientCredentialsRuntime = {
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
      ...(persisted?.authCodePublicClient || {}),
      providerId,
    },
    authCodeConfidentialClient: {
      ...defaults.authCodeConfidentialClient!,
      ...(persisted?.authCodeConfidentialClient || {}),
      providerId,
    },
    clientCredentials: {
      ...defaults.clientCredentials!,
      ...(persisted?.clientCredentials || {}),
      providerId,
    },
  };
};

const storageKeyForProvider = (providerId: ProviderAppId) =>
  `${SETTINGS_STORAGE_PREFIX}${providerId}`;

const defaultAuthCodePublicClientRuntime: AuthCodePublicClientRuntime = {
  codeVerifier: "",
  codeChallenge: "",
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
  useEffect(() => {
    if (globalThis.window === undefined) return;
    try {
      const next = { ...defaultSettingsByProvider };

      for (const providerId of ["entra", "auth0"] as const) {
        const raw = localStorage.getItem(storageKeyForProvider(providerId));
        if (!raw) continue;
        next[providerId] = mergeProviderSettings(
          providerId,
          JSON.parse(raw) as Partial<Settings>,
        );
      }

      setSettingsState(next);
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
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

  useEffect(() => {
    setAuthCodePublicClientRuntimeState(defaultAuthCodePublicClientRuntime);
    setAuthCodeConfidentialClientRuntimeState(
      defaultAuthCodeConfidentialClientRuntime,
    );
    setClientCredentialsRuntimeState(defaultClientCredentialsRuntime);
  }, [activeProviderId]);

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
