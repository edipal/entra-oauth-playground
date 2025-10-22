"use client";
import React, {createContext, useContext, useState, ReactNode} from 'react';

// Persisted configuration that users can edit and we keep across sessions
export type AuthCodePublicClientConfig = {
  tenantId?: string;
  clientId?: string;
  redirectUri?: string;
  scopes?: string;
  apiEndpointUrl?: string;
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

export type Settings = {
  // Per-flow persisted config
  authCodePublicClient?: AuthCodePublicClientConfig;
};

type SettingsContextValue = {
  // Persisted app settings
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  // Convenience accessors for the auth code public client config
  authCodePublicClientConfig: AuthCodePublicClientConfig;
  setAuthCodePublicClientConfig: (s: Partial<AuthCodePublicClientConfig> | ((prev: AuthCodePublicClientConfig) => Partial<AuthCodePublicClientConfig>)) => void;
  // Runtime (not persisted)
  authCodePublicClientRuntime: AuthCodePublicClientRuntime;
  setAuthCodePublicClientRuntime: (s: Partial<AuthCodePublicClientRuntime> | ((prev: AuthCodePublicClientRuntime) => Partial<AuthCodePublicClientRuntime>)) => void;
  resetAuthCodePublicClientRuntime: () => void;
};

const defaultAuthCodePublicClientConfig: AuthCodePublicClientConfig = {
  tenantId: '',
  clientId: '',
  redirectUri: '',
  scopes: 'openid profile offline_access',
  apiEndpointUrl: 'https://graph.microsoft.com/v1.0/me'
};

const defaultSettings: Settings = {
  authCodePublicClient: defaultAuthCodePublicClientConfig
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

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({children}: {children: ReactNode}) {
  // Persisted settings
  const [settings, setSettingsState] = useState<Settings>(() => {
    // try to read from localStorage if available
    try {
      const raw = localStorage.getItem('app:settings');
      if (raw) {
        // Parse persisted settings and deep-merge nested authCodePublicClient with defaults
        const parsed = JSON.parse(raw) as Partial<Settings>;
        const persistedAuth = parsed.authCodePublicClient || {};
        const mergedAuth = { ...defaultAuthCodePublicClientConfig, ...persistedAuth };
        return { ...defaultSettings, ...parsed, authCodePublicClient: mergedAuth };
      }
    } catch (e) {
      // ignore
    }
    return defaultSettings;
  });

  // In-memory runtime for the current flow (not persisted)
  const [authCodePublicClientRuntime, setRuntimeState] = useState<AuthCodePublicClientRuntime>(defaultAuthCodePublicClientRuntime);

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

  const value: SettingsContextValue = {
    settings,
    setSettings,
    authCodePublicClientConfig,
    setAuthCodePublicClientConfig,
    authCodePublicClientRuntime,
    setAuthCodePublicClientRuntime,
    resetAuthCodePublicClientRuntime
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
