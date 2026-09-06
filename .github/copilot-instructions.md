# OAuth Playground - AI Developer Guidelines

This codebase is a Next.js (App Router) project designed to help developers explore Microsoft Entra ID and Auth0 OAuth 2.0/OIDC flows visually.

## Big Picture Architecture
- **Provider Workspaces:** `src/lib/providerRegistry.ts` defines the two provider workspaces (`entra`, `auth0`), route prefixes, supported flows, and menu groups. `src/hooks/useActiveProvider.ts` derives the active provider from the route and powers the topbar provider selector.
- **State Management:** `src/components/SettingsContext.tsx` is the central source of truth. It separates persisted per-flow config (stored per provider under `localStorage` keys like `app:settings:entra` and `app:settings:auth0`) from runtime-only sensitive/transient state. Configs are isolated by provider and by flow: `authCodePublicClient`, `authCodeConfidentialClient`, and `clientCredentials`.
- **Hydration Pattern:** `SettingsProvider` initializes with SSR-safe defaults, then hydrates persisted settings client-side and exposes `hydrated`. Pages depend on `hydrated` for browser-only defaults (for example, deriving `redirectUri` from `window.location.origin`). Note: `hydrated` is set to `true` in the `finally` block so it becomes `true` even when no localStorage data exists.
- **Flow Composition:** Provider route pages under `src/app/[locale]/(main)/entra/...` and `src/app/[locale]/(main)/auth0/...` render shared flow components from `src/components/flows/`. Components in `src/components/steps/` are reusable step UIs: `StepOverview`, `StepSettings`, `StepPkce`, `StepAuthorize`, `StepAuthentication` (client auth method — secret vs. certificate/private_key_jwt), `StepCallback`, `StepTokens`, `StepDecode`, `StepValidate`, `StepCallApi`. Provider-specific step extensions live under `src/components/steps/auth0/` or `src/components/steps/entra/`.
- **Streamlined Mode:** Each flow config has a `streamlined` boolean flag. When enabled, steps auto-advance and advanced fields are hidden, providing a simpler walkthrough experience.
- **Client vs. Server Side OAuth:** Public client auth code token exchange is done directly from the browser to the token endpoint. **Confidential flows** (auth code confidential + client credentials) execute token exchange through provider-specific Next.js Route Handlers under `src/app/api/oauth/entra/` and `src/app/api/oauth/auth0/`, sharing common handler logic in the legacy route files. Both routes support two `clientAuthMethod` values: `"secret"` (client secret in request body) and `"certificate"` (RS256 private_key_jwt client assertion built with `buildClientAssertion` from `src/lib/jwtSign.ts`). Auth0 also has PAR and JAR helper routes under `src/app/api/oauth/auth0/`.
- **OAuth Callback Bridge:** The callback endpoint is `src/app/callback/auth-code/route.ts` (outside localized routes) and supports both `GET` query callbacks and `POST` form_post callbacks. It relays results via `postMessage` to the opener window, then closes itself.
- **Server-side Endpoint Safety:** Server token exchange routes validate token endpoints via `src/lib/tokenEndpoint.ts` (`resolveAndValidateTokenEndpoint`) to enforce HTTPS and restrict hosts to trusted provider endpoints: Microsoft login hosts for Entra and exact Auth0 tenant endpoints derived from the configured Auth0 issuer.
- **JWT & Crypto Utilities:** All auth and crypto logic lives in `src/lib/`:
  - `jwtSign.ts` — builds and signs RS256 client assertion JWTs (`buildClientAssertion`, `buildClientAssertionClaims`) using `jose`
  - `jwtVerify.ts` — verifies JWTs against JWKS endpoints
  - `jwtDecode.ts` — decodes JWT header and payload (no signature verification)
  - `jwtClaims.ts` — parses a decoded JWT payload into structured `ClaimRow[]` for display, with documentation links for Entra, Auth0, and JWT/IANA claim references
  - `requestObject.ts` — builds RS256 JWT-secured authorization request objects for JAR flows
  - `certificate.ts` — browser-side RSA-2048 key pair generation and self-signed X.509 certificate creation using the Web Crypto API
  - `pkce.ts` — PKCE code verifier and S256 challenge generation
  - `random.ts` — cryptographically random URL-safe strings and GUID-like values
  - `tokenEndpoint.ts` — SSRF-safe token endpoint resolution and validation
  - `translation.ts` — `TranslationUtils` helpers (see i18n section below)
- **Tools Section:** The app includes a standalone Tools area at `src/app/[locale]/(main)/tools/`. Currently contains a JWT Decoder (`tools/jwt-decoder/page.tsx`) that decodes any JWT and displays parsed header/payload claims with descriptions. This is independent of the OAuth flow pages.

## Key Developer Workflows
- **Local Dev Server:** Because Entra ID redirect URIs often require HTTPS, we run the dev server with Next.js experimental HTTPS. Always run: `pnpm dev` (which executes `next dev --experimental-https`). The local app is hosted at `https://localhost:3000`.
- **Build & Start:** `pnpm build` creates a production build (also sets `SASS_SILENCE_DEPRECATIONS`). `pnpm start` serves the production build. The project is configured with `output: 'standalone'` in `next.config.js`.
- **Formatting & Linting:** Use `pnpm format` (Prettier) and `pnpm lint` (ESLint) before committing. If you modify UI or `.ts/.tsx` files, ensure they conform to Prettier formatting.
- **Dependencies:** Use `pnpm` exclusively; do not use `npm` or `yarn`.
- **README:** Keep `README.md` up to date when making changes that affect setup steps, features, project structure, or configuration. If a change would affect how someone gets started or uses the app, update the README accordingly.

## Styling & i18n
- **UI Frameworks:** We use PrimeReact + PrimeFlex + SCSS (found in `src/styles/` and `src/components/layout/`). **Do not use Tailwind CSS**.
- **Internationalization (i18n):** Hardcoded strings are strictly avoided in components. Text is resolved using `useTranslations("ComponentName")` via `next-intl`. Supported locales are `en` (English) and `de` (German). Add keys to both `src/messages/en.json` and `src/messages/de.json`; for menu/navigation copy, also update `src/messages/menu.en.json` and `src/messages/menu.de.json`.
- **Translation Helpers:** `TranslationUtils` in `src/lib/translation.ts` provides three static methods:
  - `safeT(t, key)` — returns a translation even when the value contains literal `{tenant}` placeholders (passes a dummy interpolation to avoid runtime errors)
  - `safeTWithFallback(t, key, fallback)` — like `safeT` but returns a `fallback` string when the key is missing or empty
  - `maybeT(t, key, fallback)` — returns the translation if the key exists and the value doesn't echo back the key; otherwise returns `fallback`

## Common Scenarios & Code Patterns
- **Creating or Changing Flow Steps:** Add/update step UI in `src/components/steps/`, then wire orchestration (step order, validation, transitions, runtime mutations) in the corresponding route page under `src/app/[locale]/(main)/.../page.tsx`.
- **Adding a New Client Auth Method:** `ClientAuthMethod` is defined in `src/types/client-auth.ts` as `"secret" | "certificate"`. The `StepAuthentication` component handles the UI; server-side routes in `src/app/api/oauth/` handle the actual token request construction.
- **Handling Secrets:** Avoid rendering or logging secrets. Keep secrets and private keys in runtime-only context state (e.g., `clientSecret`, `privateKeyPem`); do not persist them to `localStorage`.
- **Middleware/Locale Awareness:** `src/middleware.ts` handles locale routing for app pages and intentionally excludes `/api` and `/callback` so OAuth callbacks remain reachable at `/callback/auth-code` without locale prefixes.
