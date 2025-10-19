"use client";
import React, {createContext, useContext, useState, ReactNode} from 'react';

type Settings = {
  entraTenantId: string;
};

type SettingsContextValue = {
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
};

const defaultSettings: Settings = {
  entraTenantId: ''
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({children}: {children: ReactNode}) {
  const [settings, setSettingsState] = useState<Settings>(() => {
    // try to read from localStorage if available
    try {
      const raw = localStorage.getItem('app:settings');
      if (raw) return {...defaultSettings, ...JSON.parse(raw)};
    } catch (e) {
      // ignore
    }
    return defaultSettings;
  });

  const setSettings = (s: Partial<Settings>) => {
    setSettingsState(prev => {
      const next = {...prev, ...s};
      try {
        localStorage.setItem('app:settings', JSON.stringify(next));
      } catch (e) {
        // ignore localStorage failures
      }
      return next;
    });
  };

  return <SettingsContext.Provider value={{settings, setSettings}}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
