"use client";
import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';

// Persisted configuration that users can edit and we keep across sessions
export type AuthCodePublicClientConfig = {
  tenantId?: string;
  clientId?: string;
  redirectUri?: string;
  scopes?: string;
  apiEndpointUrl?: string;
  // Streamlined mode: auto-run steps and hide advanced fields in public client flow
  streamlined?: boolean;
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
export type ClientAuthMethod = 'secret' | 'certificate';
export type AuthCodeConfidentialClientConfig = {
  tenantId?: string;
  clientId?: string;
  redirectUri?: string;
  scopes?: string;
  apiEndpointUrl?: string;
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

export type Settings = {
  // Per-flow persisted config
  authCodePublicClient?: AuthCodePublicClientConfig;
  authCodeConfidentialClient?: AuthCodeConfidentialClientConfig;
};

type SettingsContextValue = {
  // Persisted app settings
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  // True after localStorage has been read and merged into settings
  hydrated: boolean;
  // Convenience accessors for the auth code public client config
  authCodePublicClientConfig: AuthCodePublicClientConfig;
  setAuthCodePublicClientConfig: (s: Partial<AuthCodePublicClientConfig> | ((prev: AuthCodePublicClientConfig) => Partial<AuthCodePublicClientConfig>)) => void;
  // Runtime (not persisted)
  authCodePublicClientRuntime: AuthCodePublicClientRuntime;
  setAuthCodePublicClientRuntime: (s: Partial<AuthCodePublicClientRuntime> | ((prev: AuthCodePublicClientRuntime) => Partial<AuthCodePublicClientRuntime>)) => void;
  resetAuthCodePublicClientRuntime: () => void;

  // Confidential client accessors
  authCodeConfidentialClientConfig: AuthCodeConfidentialClientConfig;
  setAuthCodeConfidentialClientConfig: (s: Partial<AuthCodeConfidentialClientConfig> | ((prev: AuthCodeConfidentialClientConfig) => Partial<AuthCodeConfidentialClientConfig>)) => void;
  authCodeConfidentialClientRuntime: AuthCodeConfidentialClientRuntime;
  setAuthCodeConfidentialClientRuntime: (s: Partial<AuthCodeConfidentialClientRuntime> | ((prev: AuthCodeConfidentialClientRuntime) => Partial<AuthCodeConfidentialClientRuntime>)) => void;
  resetAuthCodeConfidentialClientRuntime: () => void;
};

const defaultAuthCodePublicClientConfig: AuthCodePublicClientConfig = {
  tenantId: '',
  clientId: '',
  redirectUri: '',
  scopes: 'openid profile offline_access',
  apiEndpointUrl: 'https://graph.microsoft.com/v1.0/me',
  streamlined: false
};

const defaultSettings: Settings = {
  authCodePublicClient: defaultAuthCodePublicClientConfig,
  authCodeConfidentialClient: {
    tenantId: '',
    clientId: '',
    redirectUri: '',
    scopes: 'openid profile offline_access',
    apiEndpointUrl: 'https://graph.microsoft.com/v1.0/me',
    pkceEnabled: true,
    clientAuthMethod: 'secret',
    clientAssertionKid: '',
    clientAssertionX5t: ''
  }
};

const defaultAuthCodePublicClientRuntime: AuthCodePublicClientRuntime = {
  codeVerifier: '',
  codeChallenge: '',
  authEndpoint: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
  stateParam: '',
  nonce: '',
  callbackUrl: '',
  callbackBody: '',
  authCode: '',
  extractedState: '',
  callbackValidated: false,
  accessToken: '',
  idToken: ''
};

const defaultAuthCodeConfidentialClientRuntime: AuthCodeConfidentialClientRuntime = {
  codeVerifier: '',
  codeChallenge: '',
  authEndpoint: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
  stateParam: '',
  nonce: '',
  callbackUrl: '',
  callbackBody: '',
  authCode: '',
  extractedState: '',
  callbackValidated: false,
  accessToken: '',
  idToken: '',
  clientSecret: '',
  privateKeyPem: '',
  publicKeyPem: '',
  certificatePem: '',
  thumbprintSha1: '',
  thumbprintSha256: '',
  thumbprintSha1Base64Url: '',
  clientAssertion: '',
  assertionClaims: '',
  testAssertion: '',
  decodedAssertion: ''
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({children}: {children: ReactNode}) {
  // Persisted settings
  // Initialize with defaults for SSR consistency. We'll hydrate from localStorage after mount.
  const [settings, setSettingsState] = useState<Settings>(defaultSettings);
  const [hydrated, setHydrated] = useState(false);

  // After mount, read persisted settings (if any) and merge with defaults.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('app:settings');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Settings>;
      const persistedPublic = parsed.authCodePublicClient || {};
      const mergedPublic = { ...defaultAuthCodePublicClientConfig, ...persistedPublic };
      const persistedConf = parsed.authCodeConfidentialClient || {};
      const mergedConf = { ...defaultSettings.authCodeConfidentialClient!, ...persistedConf };
      const next = { ...defaultSettings, ...parsed, authCodePublicClient: mergedPublic, authCodeConfidentialClient: mergedConf } as Settings;
      setSettingsState(next);
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, []);

  // In-memory runtime for the current flow (not persisted)
  const [authCodePublicClientRuntime, setRuntimeState] = useState<AuthCodePublicClientRuntime>(defaultAuthCodePublicClientRuntime);
  const [authCodeConfidentialClientRuntime, setConfRuntimeState] = useState<AuthCodeConfidentialClientRuntime>(defaultAuthCodeConfidentialClientRuntime);

  const persist = (next: Settings) => {
    try {
      localStorage.setItem('app:settings', JSON.stringify(next));
    } catch (e) {
      // ignore localStorage failures
    }
  };

  const setSettings = (s: Partial<Settings>) => {
    setSettingsState(prev => {
      const next = {...prev, ...s};
      persist(next);
      return next;
    });
  };

  const setAuthCodePublicClientConfig: SettingsContextValue['setAuthCodePublicClientConfig'] = (update) => {
    setSettingsState(prev => {
      const prevCfg = prev.authCodePublicClient || defaultAuthCodePublicClientConfig;
      const patch = typeof update === 'function' ? update(prevCfg) : update;
      const nextCfg = {...prevCfg, ...patch};
      const next = {...prev, authCodePublicClient: nextCfg};
      persist(next);
      return next;
    });
  };

  const setAuthCodePublicClientRuntime: SettingsContextValue['setAuthCodePublicClientRuntime'] = (update) => {
    setRuntimeState(prev => {
      const patch = typeof update === 'function' ? update(prev) : update;
      return {...prev, ...patch};
    });
  };

  const resetAuthCodePublicClientRuntime = () => setRuntimeState(defaultAuthCodePublicClientRuntime);

  const authCodePublicClientConfig = settings.authCodePublicClient || defaultAuthCodePublicClientConfig;

  // Confidential client setters
  const setAuthCodeConfidentialClientConfig: SettingsContextValue['setAuthCodeConfidentialClientConfig'] = (update) => {
    setSettingsState(prev => {
      const prevCfg = prev.authCodeConfidentialClient || defaultSettings.authCodeConfidentialClient!;
      const patch = typeof update === 'function' ? update(prevCfg) : update;
      const nextCfg = { ...prevCfg, ...patch };
      const next = { ...prev, authCodeConfidentialClient: nextCfg };
      persist(next);
      return next;
    });
  };

  const setAuthCodeConfidentialClientRuntime: SettingsContextValue['setAuthCodeConfidentialClientRuntime'] = (update) => {
    setConfRuntimeState(prev => {
      const patch = typeof update === 'function' ? update(prev) : update;
      return { ...prev, ...patch };
    });
  };

  const resetAuthCodeConfidentialClientRuntime = () => setConfRuntimeState(defaultAuthCodeConfidentialClientRuntime);

  const authCodeConfidentialClientConfig = settings.authCodeConfidentialClient || defaultSettings.authCodeConfidentialClient!;

  const value: SettingsContextValue = {
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
    resetAuthCodeConfidentialClientRuntime
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
