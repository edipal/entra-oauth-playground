## ENTRA OAuth Playground — Technical Documentation

This document explains the structure and key implementation details of the "entra-oauth-playground" repo so you can confidently change it or copy functionality into other projects.

Note: ignore `node_modules/` and `.next/` when browsing the project.

## Quick start

Commands (run in the repository root):

```bash
# install
npm install

# dev server
npm run dev

# production build + start
npm run build
npm run start
```

The repo uses Next.js (App Router), TypeScript and PrimeReact for UI.

## High-level architecture

- Next.js App Router (app/). The localized UI is under `app/[locale]`.
- Client components use PrimeReact UI primitives and PrimeFlex for layout.
- i18n is handled with `next-intl` (plugin configured in `next.config.mjs`).
- A small set of API routes and a callback handler are provided for demo purposes.
- `src/components/SettingsContext.tsx` holds persisted settings (localStorage) and runtime flow state.
- `src/utils/*` contains PKCE, JWT helpers and client-side JWT signing utilities.

## Important files and folders

- `package.json` — scripts and dependencies (Next 15+, React 19, primereact, next-intl).
- `next.config.mjs` — integrates next-intl plugin (see `i18n/request.ts`).
- `i18n.ts` and `next-intl.config.ts` — locale list and request config used by the plugin.
- `tsconfig.json` — project TypeScript config and path aliases (`@/components`, `@/utils`, `@/messages`).

- `app/layout.tsx` — root layout imports global CSS and PrimeReact theme.
- `app/[locale]/layout.tsx` — locale-aware layout; it sets request locale server-side and wraps the app with `Providers`.
- `app/[locale]/Sidebar.tsx` — left navigation using PrimeReact `PanelMenu` (client component).
- `app/[locale]/page.tsx` — localized home page (client component).

- `app/[locale]/authorization-code/` — two flows implemented:
  - `public-client/` — UI and components to demonstrate Authorization Code + PKCE in-browser.
  - `confidential-client/` — UI for confidential client (client secret or certificate flow); token exchange uses a server route.

- `app/callback/auth-code/route.ts` — (callback page) receives the OAuth redirect from the provider and posts the data back to the opener window. (Used by the popup flow.)

- `app/api/log-error/route.ts` — small API to receive client error logs (used by GlobalError component).
- `app/api/oauth/exchange-token/route.ts` — server-side exchange helper for confidential client flows (accepts client secret or private_key_jwt and exchanges code for tokens).

- `src/components/Providers.tsx` — wraps `NextIntlClientProvider` + `SettingsProvider`.
- `src/components/SettingsContext.tsx` — central state for persisted settings and ephemeral runtime (key: `app:settings` in localStorage).
- `src/components/LabelWithHelp.tsx` — small helper to show field label + tooltip.

- `src/i18n/config.ts` and `src/messages/*.json` — locale messages (`en.json`, `de.json`).

- `src/utils/pkce.ts` — S256 PKCE helpers: `randomCodeVerifier`, `computeS256Challenge`.
- `src/utils/jwt.ts` — JWT decode helpers for display only (no verification).
- `src/utils/jwtSign.ts` — utilities to build and sign JWT client assertions (RS256) using WebCrypto (used in certificate client auth demo).
- `src/utils/translation.ts` — small helper to safely read i18n raw strings.

## Routing and localization

- The app uses Next.js App Router. Primary dynamic route is `app/[locale]` which scopes the whole site per locale (e.g. `/en`, `/de`).
- `app/[locale]/layout.tsx` calls `setRequestLocale(locale)` (server) and dynamically imports locale messages. `generateStaticParams` returns the supported locales.
- `next-intl` plugin is configured in `next.config.mjs` using `i18n/request.ts` which maps requests to message bundles in `src/messages`.

Import notes: translation hooks are used in client components via `useTranslations` from `next-intl`.

## UI and components

- PrimeReact is the component library; CSS is imported globally in `app/layout.tsx` and `app/[locale]/layout.tsx` (theme + core + icons + primeflex).
- Components are mostly client components ("use client") in `app/[locale]/authorization-code/*` and `src/components/*`.
- `SettingsContext` exposes both persisted configuration (tenantId, clientId, redirectUri, scopes, apiEndpointUrl, etc.) and ephemeral runtime (codeVerifier, codeChallenge, authCode, accessToken, idToken, etc.).
- The steps for the public client flow are implemented as separate components under `public-client/components/` (StepOverview, StepSettings, StepPkce, StepAuthorize, StepCallback, StepTokens, StepDecode, StepValidate, StepCallApi). Confidential client reuses many steps and adds authentication UI.

How the popup callback flow works (public client):

1. Authorization URL is built in the client (StepAuthorize) including PKCE params.
2. `window.open` launches provider sign-in in a popup to the authorization endpoint.
3. Provider redirects to the app callback path (e.g. `/callback/auth-code`) which reads the incoming params and posts them back to opener via `window.opener.postMessage({type: 'oauth_callback', ...})`.
4. The client listens for `message` events and extracts code/state and continues (exchange or display).

Confidential client token exchange:

- The confidential flow posts the exchange request to the server route `app/api/oauth/exchange-token/route.ts` which performs the token request using either client_secret or a generated `client_assertion` (from `jwtSign`) and returns tokens to the client UI for display.

## Utilities

- PKCE (S256): `randomCodeVerifier()` and `computeS256Challenge(verifier)` — use these on the client before building authorize URL.
- JWT decode: `decodeJwt(token)` — quick decode to readable JSON for header/payload.
- JWT signing: `buildClientAssertion({clientId, tokenEndpoint, privateKeyPem, kid, lifetimeSec})` — builds RS256 client_assertion using WebCrypto. Only available where `crypto.subtle` exists (browser).

## Settings persistence

- `SettingsContext` persists `settings` into localStorage under key `app:settings`.
- Persistent fields: `authCodePublicClient` and `authCodeConfidentialClient` configuration objects (tenantId, clientId, redirectUri, scopes, apiEndpointUrl, etc.).
- Runtime fields (codeVerifier, codeChallenge, tokens, etc.) are kept in memory and intentionally not persisted.

## TypeScript and path aliases

- Path aliases are declared in `tsconfig.json` (e.g. `@/components/*`, `@/utils/*`, `@/messages/*`). Keep imports consistent to make copying easier.

## How to modify or copy functionality into another project

- To copy the PKCE + authorize popup flow: copy `src/utils/pkce.ts`, the authorize UI code (e.g. `StepAuthorize.tsx`) and the client-side popup/callback logic. The callback route implementation (server/client) is in `app/callback/auth-code/route.ts` — copy its logic to your app's callback handler and ensure origins match.
- To copy confidential client exchange with `client_assertion`: copy `src/utils/jwtSign.ts` and the server-side `app/api/oauth/exchange-token/route.ts` logic. Do NOT hardcode secrets; use secure server-side configuration.
- To reuse the settings model and persistence: copy `src/components/SettingsContext.tsx` and adapt the defaults schema.

Import / alias tip: keep or adapt the `tsconfig.json` paths or replace `@/` imports with relative imports when integrating into other repos.

## Security & production caveats

- This project is a playground/demonstration. It stores user-provided configuration in localStorage for convenience — do not store secrets (client secrets or private keys) in localStorage in production.
- Private key signing (`jwtSign`) is run client-side for demo only (certificate/private_key_jwt). In production, client secrets and private keys should only be used on a secure server.
- When testing with Microsoft Entra ID / OAuth providers, ensure redirect URIs are registered exactly as used (including scheme and host). Popup flows can be blocked by browsers—use the same origin for callback and parent.

## Troubleshooting & build checks

- Typecheck / build: `npm run build` (Next.js will typecheck when `typescript` is configured). Fix any TypeScript errors reported by the build.
- If translations are missing, `app/[locale]/layout.tsx` falls back to `en.json` and then an empty messages object.
