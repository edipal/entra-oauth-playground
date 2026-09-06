import type { Page } from "@playwright/test";

// Mirrors the persisted shape in src/components/SettingsContext.tsx. Seeding these
// keys lets a spec start on the step it actually tests instead of retyping the
// settings form for every combination in the matrix.

export type ProviderId = "entra" | "auth0";
export type FlowKey =
  | "authCodePublicClient"
  | "authCodeConfidentialClient"
  | "clientCredentials";

export type AuthRequestMode = "url" | "par" | "jar" | "par-jar";

export type FlowSettings = {
  providerId?: ProviderId;
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
  clientAuthMethod?: "secret" | "certificate";
  clientAssertionKid?: string;
  clientAssertionX5t?: string;
};

const STORAGE_PREFIX = "app:settings:";

// Placeholder identifiers for offline specs: syntactically valid, tenant-free.
export const DEMO = {
  entraTenant: "8f2a1c4e-5b7d-4a19-9c3e-2d6f8a0b1c5d",
  entraClient: "3e9b7d21-4c8a-4f16-b5d2-7a1e9c04f8b3",
  auth0Issuer: "https://demo-tenant.eu.auth0.com",
  auth0Client: "K8sQx2mVdemoClientIdExample7pLzR",
  auth0Audience: "https://api.demo-tenant.example/orders",
} as const;

/**
 * Writes provider-scoped settings before the app boots, so the first render
 * already has them. Must be called before the page navigates.
 */
export async function seedSettings(
  page: Page,
  providerId: ProviderId,
  flows: Partial<Record<FlowKey, FlowSettings>>,
) {
  await page.addInitScript(
    ({ key, flows: seeded }) => {
      const existing = JSON.parse(
        globalThis.localStorage.getItem(key) || "{}",
      ) as Record<string, unknown>;

      const merged = { ...existing };
      for (const [flow, values] of Object.entries(seeded)) {
        merged[flow] = {
          ...(existing[flow] as Record<string, unknown> | undefined),
          ...values,
        };
      }

      globalThis.localStorage.setItem(key, JSON.stringify(merged));
    },
    { key: `${STORAGE_PREFIX}${providerId}`, flows },
  );
}

/**
 * Writes a workspace key verbatim, so a spec can put something there the app
 * cannot parse — a half-written value from a closed tab, a hand edit.
 */
export async function seedRawSettings(
  page: Page,
  providerId: ProviderId,
  raw: string,
) {
  await page.addInitScript(
    ({ key, value }) => globalThis.localStorage.setItem(key, value),
    { key: `${STORAGE_PREFIX}${providerId}`, value: raw },
  );
}

/** Reads back what the app persisted, to assert workspace isolation. */
export async function readSettings(page: Page, providerId: ProviderId) {
  return page.evaluate(
    (key) => JSON.parse(globalThis.localStorage.getItem(key) || "null"),
    `${STORAGE_PREFIX}${providerId}`,
  );
}

/** The raw string under a workspace key, or null. */
export async function readRawSettings(
  page: Page,
  providerId: ProviderId,
  suffix = "",
) {
  return page.evaluate(
    (key) => globalThis.localStorage.getItem(key),
    `${STORAGE_PREFIX}${providerId}${suffix}`,
  );
}

/** Any localStorage key verbatim — for the pre-workspace `app:settings`. */
export async function seedRawKey(page: Page, key: string, raw: string) {
  await page.addInitScript(
    ({ storageKey, value }) =>
      globalThis.localStorage.setItem(storageKey, value),
    { storageKey: key, value: raw },
  );
}

export async function readRawKey(page: Page, key: string) {
  return page.evaluate(
    (storageKey) => globalThis.localStorage.getItem(storageKey),
    key,
  );
}

export function defaultsFor(
  providerId: ProviderId,
  overrides: FlowSettings = {},
): FlowSettings {
  const base: FlowSettings =
    providerId === "entra"
      ? {
          providerId: "entra",
          tenantId: DEMO.entraTenant,
          clientId: DEMO.entraClient,
          scopes: "openid profile offline_access",
        }
      : {
          providerId: "auth0",
          issuerUrl: DEMO.auth0Issuer,
          clientId: DEMO.auth0Client,
          audience: DEMO.auth0Audience,
          scopes: "openid profile email offline_access",
        };

  return { ...base, ...overrides };
}
