"use client";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "@/navigation";
import {
  DEFAULT_PROVIDER_APP_ID,
  PROVIDER_APP_IDS,
  getProviderSwitchTarget,
  getRouteProvider,
  type ProviderAppId,
} from "@/lib/providerRegistry";

const SELECTED_PROVIDER_STORAGE_KEY = "app:selected-provider";
const SELECTED_PROVIDER_EVENT = "provider-selection-changed";

function readStoredProvider(): ProviderAppId {
  if (globalThis.window === undefined) return DEFAULT_PROVIDER_APP_ID;
  try {
    const value = globalThis.window.localStorage.getItem(
      SELECTED_PROVIDER_STORAGE_KEY,
    );
    return value === "auth0" || value === "entra"
      ? value
      : DEFAULT_PROVIDER_APP_ID;
  } catch {
    return DEFAULT_PROVIDER_APP_ID;
  }
}

function writeStoredProvider(providerId: ProviderAppId) {
  if (globalThis.window === undefined) return;
  try {
    globalThis.window.localStorage.setItem(
      SELECTED_PROVIDER_STORAGE_KEY,
      providerId,
    );
  } catch {
    // Ignore storage write failures (e.g. storage disabled, quota exceeded)
  }
  try {
    globalThis.window.dispatchEvent(
      new CustomEvent(SELECTED_PROVIDER_EVENT, { detail: providerId }),
    );
  } catch {
    // Ignore event dispatch failure
  }
}

function subscribeToProviderChanges(listener: () => void) {
  if (globalThis.window === undefined) return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === SELECTED_PROVIDER_STORAGE_KEY) listener();
  };
  const handleProviderChange = () => listener();

  globalThis.window.addEventListener("storage", handleStorage);
  globalThis.window.addEventListener(
    SELECTED_PROVIDER_EVENT,
    handleProviderChange,
  );

  return () => {
    globalThis.window.removeEventListener("storage", handleStorage);
    globalThis.window.removeEventListener(
      SELECTED_PROVIDER_EVENT,
      handleProviderChange,
    );
  };
}

export function useActiveProvider() {
  const pathname = usePathname();
  const router = useRouter();
  const routeProvider = getRouteProvider(pathname);
  const storedProvider = useSyncExternalStore(
    subscribeToProviderChanges,
    readStoredProvider,
    () => DEFAULT_PROVIDER_APP_ID,
  );

  useEffect(() => {
    if (!routeProvider) return;
    writeStoredProvider(routeProvider);
  }, [routeProvider]);

  const activeProviderId = routeProvider || storedProvider;

  const providerOptions = useMemo(
    () =>
      PROVIDER_APP_IDS.map((providerId) => ({
        labelKey: providerId === "entra" ? "Entra" : "Auth0",
        value: providerId,
      })),
    [],
  );

  const setActiveProviderId = useCallback(
    (providerId: ProviderAppId) => {
      writeStoredProvider(providerId);
      const target = getProviderSwitchTarget(pathname, providerId);
      if (target !== pathname) {
        router.push(target);
      }
    },
    [pathname, router],
  );

  return {
    activeProviderId,
    routeProvider,
    providerOptions,
    setActiveProviderId,
  };
}
