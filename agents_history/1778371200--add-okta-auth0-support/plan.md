Recommendation

Split the app into explicit Entra and Auth0 workspaces, with provider selection controlled by the route and a compact selector in the top-right header. Keep Auth0 support for all three existing flows: public authorization code with PKCE, confidential authorization code, and client credentials. Drop Okta now, keep provider-agnostic tools shared outside the provider folders, and do not migrate existing localStorage settings because the deployed app is effectively Entra-only today.

Reference Notes

- Auth0 authorization code for API access uses the tenant authorization endpoint, token endpoint, `audience` for API access tokens, `scope`, `state`, `nonce`, redirect URI, and PKCE for public clients. Auth0 access tokens may be JWT, encrypted JWE, or opaque depending on API and tenant settings.
- Auth0 public clients should use authorization code with PKCE and no client secret. Token exchange sends `grant_type=authorization_code`, `client_id`, `code`, `redirect_uri`, and `code_verifier`.
- Auth0 confidential authorization code can use a client secret or private_key_jwt at the token endpoint. PKCE can remain available as an optional hardening setting.
- Auth0 client credentials uses `grant_type=client_credentials`, `audience`, optional scopes, and either client secret or private_key_jwt authentication.
- Auth0 private_key_jwt uses a signed client assertion with `iss` and `sub` equal to the client id, `aud` equal to the token endpoint, short `exp`, `iat`, and a unique `jti`.
- Auth0 RAR is expressed with an `authorization_details` JSON array in the authorization request. It should be modeled as an optional advanced auth-code input and validated as structured JSON before being sent.
- Auth0 PAR pushes authorization request parameters to the pushed authorization request endpoint, receives a `request_uri`, then starts authorization with `client_id` and `request_uri`. Treat PAR as a server-assisted step because it may require client authentication and should not become an arbitrary server-side POST primitive.
- Auth0 JAR signs authorization request parameters into a request object JWT. It can be sent directly as `request` or combined with PAR. Request-object signing key material must remain runtime-only.
- Entra remains the default provider and keeps the current three flows. For auth-code flows, add PAR as an Entra-specific optional authorization request mode if the tenant/app supports it. Do not add Auth0-only RAR/JAR controls to Entra pages.
- Claim details should become provider-aware. Auth0 claim descriptions should reference Auth0 JWT claim guidance plus RFC 7519 and the IANA JWT claims registry; Entra claim descriptions should keep Microsoft Learn references.

Target Information Architecture

- `src/app/[locale]/(main)/entra/page.tsx`
- `src/app/[locale]/(main)/entra/authorization-code/public-client/page.tsx`
- `src/app/[locale]/(main)/entra/authorization-code/confidential-client/page.tsx`
- `src/app/[locale]/(main)/entra/client-credentials/page.tsx`
- `src/app/[locale]/(main)/auth0/page.tsx`
- `src/app/[locale]/(main)/auth0/authorization-code/public-client/page.tsx`
- `src/app/[locale]/(main)/auth0/authorization-code/confidential-client/page.tsx`
- `src/app/[locale]/(main)/auth0/client-credentials/page.tsx`
- `src/app/[locale]/(main)/tools/jwt-decoder/page.tsx` stays shared and appears in both provider menu contexts.

Legacy unprefixed flow routes should redirect to the equivalent Entra route so existing links keep working without localStorage migration.

Plan

1. Replace the generic provider preset model with a provider app registry. Define `ProviderAppId = "entra" | "auth0"` and a static registry with display labels, base paths, landing pages, supported flows, route aliases, and menu groups. Acceptance criteria: Okta is gone from provider ids, options, allowlists, translations, and docs; Entra and Auth0 are the only provider workspaces.
2. Add route-derived provider state and the topbar selector. Create helpers that resolve the active provider from the pathname, map a current route to an equivalent route for another provider when available, and fall back to that provider's landing page when not. Add a compact PrimeReact header selector with an accessible label in `AppTopbar`. Acceptance criteria: refresh, deep links, back/forward navigation, and provider switching keep the header selector, content, and sidebar synchronized.
3. Make the sidebar provider-aware while keeping shared tools. Rebuild `AppMenu` from the provider registry and active provider. Include the shared JWT Decoder under Tools for both Entra and Auth0 menu contexts, but leave the tool route outside the provider folders. Acceptance criteria: switching the header selector updates the flow menu immediately, and tools remain reachable regardless of provider.
4. Split the route tree and add legacy redirects. Create the `entra` and `auth0` route folders, move or copy the current Entra flow pages into the Entra tree first, and replace old unprefixed flow pages with redirects to Entra routes. Then create Auth0-specific page entry points for all three flows. Acceptance criteria: all new provider-prefixed routes are bookmarkable, and existing Entra URLs redirect cleanly.
5. Separate persisted settings by provider. Replace the current single `app:settings` storage shape with fresh provider-specific keys or a fresh v2 namespaced object, for example `app:settings:entra` and `app:settings:auth0`. Do not read or migrate the old mixed key. Keep all secrets, private keys, client assertions, tokens, auth codes, and callback payloads runtime-only. Acceptance criteria: Entra and Auth0 restore separate browser settings and never share issuer, tenant, audience, scopes, or API endpoint values.
6. Define provider-specific config types and hooks. Keep shared runtime primitives where useful, but expose provider-specific settings hooks such as `useEntraSettings` and `useAuth0Settings` or equivalent typed accessors. Entra configs should stay tenant-centric. Auth0 configs should be issuer/domain-centric and include `audience`, API endpoint, scopes, auth request mode, RAR JSON, PAR enablement, JAR signing metadata, and client auth method where relevant. Acceptance criteria: page components do not need broad `providerId` branches to decide which fields exist.
7. Layer common and provider-specific steps. Keep protocol-generic steps directly in `src/components/steps`, including overview, PKCE, callback, token display, decode, API call, and reusable token/request preview fragments. Add `src/components/steps/entra` for Entra-only settings and PAR controls. Add `src/components/steps/auth0` for Auth0 settings, Auth0 authorization request options, RAR editor, PAR status, and JAR request-object signing controls. Acceptance criteria: common steps stay readable, and provider-specific steps avoid large `isEntra` or `showAudience` prop matrices.
8. Build Auth0 authorization-code request modes. For Auth0 public and confidential auth-code pages, support a segmented mode such as URL, PAR, JAR, and PAR + JAR. Add optional RAR as an advanced section that can feed any selected mode. Plain URL mode sends normal authorize parameters. PAR mode calls a server route, stores the returned `request_uri` in runtime state, and launches the authorize URL with `client_id` plus `request_uri`. JAR mode signs a short-lived request object JWT and uses it as `request`; PAR + JAR pushes the signed request object. Acceptance criteria: users can compare the actual parameter shape for normal, RAR, PAR, JAR, and combined PAR/JAR requests.
9. Add Auth0 PAR and request-object helpers safely. Add provider-specific server handlers or service functions for Auth0 PAR and token exchange, with exact endpoint derivation from the trusted Auth0 issuer. Add request-object claim builders and signing helpers using existing crypto/JWT dependencies. Keep request object private keys runtime-only and enforce short expiration, unique `jti`, expected `aud`, redirect URI consistency, and a reasonable serialized size limit. Acceptance criteria: PAR/JAR cannot be used to make arbitrary outbound server requests or persist signing material.
10. Keep Entra auth-code flows separate and add Entra PAR intentionally. In the Entra auth-code pages, retain the current normal authorization URL behavior and add an Entra-only PAR option if supported by the configured Entra authority. Keep Entra settings tenant-centric, and keep Microsoft Graph defaults only inside Entra pages. Acceptance criteria: Entra behavior remains familiar and Auth0-specific RAR/JAR UI never appears in Entra flows.
11. Split server token exchange by provider. Prefer provider-specific route handlers such as `/api/oauth/entra/exchange-token`, `/api/oauth/auth0/exchange-token`, `/api/oauth/entra/client-credentials`, and `/api/oauth/auth0/client-credentials`, while sharing low-level form encoding and client assertion helpers. Entra routes keep Microsoft host and tenant validation. Auth0 routes require trusted Auth0 issuer/domain and exact `/oauth/token` matching. Acceptance criteria: route handlers are small, provider trust rules are explicit, and no generic fallback accepts arbitrary HTTPS endpoints.
12. Implement Auth0 client credentials fully. Add an Auth0 client-credentials page with `audience` as a first-class required value, optional scopes, API call endpoint, client secret auth, and private_key_jwt auth. Do not default to Microsoft Graph. Acceptance criteria: Auth0 client-credentials token exchange works with secret and private_key_jwt, and API calls only use user-provided or Auth0-relevant endpoints.
13. Make decode and claims provider-aware. Refactor `jwtClaims.ts` so claim descriptions and documentation links are keyed by provider and token type, with common standard JWT claims as a shared layer. Keep Entra Microsoft references for Entra. Add Auth0 references for Auth0 JWT claims, RFC 7519, and the IANA JWT claims registry. Include Auth0-specific claims such as `permissions`, `scope`, `gty`, `azp`, `org_id`, `org_name`, and namespaced custom claims. Acceptance criteria: the claim popup shows provider-appropriate descriptions and links for Entra, Auth0, and the shared JWT Decoder context.
14. Make validation provider-specific. Keep Entra issuer, audience, nonce, time, Microsoft JWKS, and Graph-specific behavior inside Entra validation logic. Add Auth0 validation that uses the configured issuer, expected client id for ID tokens, expected API audience for access tokens when readable, and Auth0 JWKS from discovery. For encrypted JWE access tokens, show structural/encryption status and skip payload claim validation with an explicit explanation. Acceptance criteria: validation does not mark encrypted Auth0 access-token claims as failed just because the browser cannot decrypt them.
15. Update translations, README, and screenshots. Add menu labels for provider workspaces and Auth0-specific authorization request modes. Update README setup sections for Entra and Auth0 separately, including Auth0 audience, callback URL, private_key_jwt setup, PAR/RAR/JAR caveats, and encrypted access-token behavior. Refresh screenshots after the route/menu/settings work stabilizes. Acceptance criteria: docs match the new provider selector and provider-prefixed route structure.

Security and Correctness Checks

- The active provider must be derived from the URL for provider routes. Shared tool routes may use the last selected provider only for menu context and claim-reference context, not for server trust decisions.
- Do not migrate or read old `app:settings`; start with clean Entra/Auth0 settings under the new provider-scoped storage shape.
- Never persist secrets, private keys, client assertions, authorization codes, tokens, callback payloads, PAR `request_uri` values, or signed JAR request objects.
- Enforce HTTPS, trusted issuer/domain rules, and exact expected endpoint matching for Auth0 `/oauth/token` and PAR endpoints.
- Validate RAR JSON as an array, cap its size, and reject malformed or non-object entries before including it in authorization requests.
- For JAR, use short expiration, unique `jti`, expected `aud`, configured `client_id`, exact redirect URI, and runtime-only signing key material.
- Clear runtime state on provider route changes, flow resets, token exchanges, and auth request mode changes so stale PAR/JAR/RAR output cannot be reused accidentally.
- Treat Auth0 encrypted JWE access tokens as bearer tokens intended for the API. Do not attempt browser decryption or claim validation without the decryption key.

Accessibility and UX Checks

- The header provider selector must have a visible or screen-reader label, full keyboard support, and responsive sizing that does not collide with the breadcrumb or menu button.
- Provider menus must update immediately when selection changes and must not show unsupported flows.
- Auth0 advanced auth-code features should be discoverable but not noisy: keep RAR, PAR, JAR, and PAR + JAR behind a clear advanced authorization request section or mode control.
- RAR JSON errors, PAR request failures, JAR signing errors, discovery failures, and token exchange errors must produce actionable inline messages.
- Claim detail dialogs should make custom Auth0 namespaced claims understandable without implying they are part of the registered JWT claim set.

Performance Notes

- Keep the provider registry static and lightweight.
- Cache OIDC discovery by issuer for Auth0 and avoid repeated discovery fetches across steps.
- Build and sign JAR request objects only when inputs change or when the user explicitly generates one, not on every render.
- Keep shared tooling outside provider route trees to avoid duplicated bundles for the JWT Decoder.

Dependencies

existing only

Validation Plan

- Run `pnpm format`, `pnpm lint`, and `pnpm build`.
- Add or update focused tests for provider route mapping, menu generation, settings storage isolation, Auth0 endpoint derivation, PAR request construction, JAR claim construction, RAR JSON validation, and provider-specific claim descriptions if the current test setup supports them.
- Manually verify Entra public auth code, Entra confidential auth code, Entra client credentials, Auth0 public auth code with PKCE, Auth0 confidential auth code with secret and private_key_jwt, Auth0 client credentials with secret and private_key_jwt, Auth0 RAR, Auth0 PAR, Auth0 JAR, and Auth0 PAR + JAR.
