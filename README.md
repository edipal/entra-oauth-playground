# Next.js OAuth/OIDC Playground

[![CodeQL](https://github.com/edipal/entra-oauth-playground/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/edipal/entra-oauth-playground/actions/workflows/github-code-scanning/codeql)

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=edipal_entra-oauth-playground&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=edipal_entra-oauth-playground) [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=edipal_entra-oauth-playground&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=edipal_entra-oauth-playground) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=edipal_entra-oauth-playground&metric=bugs)](https://sonarcloud.io/summary/new_code?id=edipal_entra-oauth-playground) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=edipal_entra-oauth-playground&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=edipal_entra-oauth-playground)

## Disclaimer
This project was created with the assistance of GitHub Copilot. Portions of the code, structure, and documentation were generated and then reviewed/edited by a human. Please validate and test in your environment and review results before relying on them.

This is a proof of concept, not a thoughtfully designed and developed application. It may contain bugs, inefficiencies, and incomplete features.

Ensure appropriate Entra ID security and governance are in place per your organization’s policies.

## Overview
This app helps you explore common OAuth 2.0 and OpenID Connect flows visually. It breaks down the complex "dance" of modern authentication into discrete, interactive steps.

You can configure your own identity provider application details, then walk through the process of generating PKCE codes, building authorization URLs, handling callbacks, exchanging codes for tokens, and finally decoding, validating, and testing those tokens.

Supported identity providers:
- **Microsoft Entra ID**
- **Auth0**

The app is split into provider workspaces. Switch between Microsoft Entra ID and Auth0 with the selector in the sidebar, directly under the logo — it sits above the menu because changing workspace rewrites the menu below it. In the slim and horizontal layouts, and on screens narrower than 992px, the sidebar cannot hold it and the selector moves to the top bar. Each workspace has its own routes, menu entries, and locally persisted settings; nothing is shared between them.

Supported flows:
- **Authorization Code (Public Client)**
- **Authorization Code (Confidential Client)**
- **Client Credentials (Confidential Client)**

## Confidential client warning - when not running locally
> ⚠️ **Confidential client flows require server-side token exchange.**
>
> Due to browser and identity provider limitations, secrets (client secrets or private keys used for `client_assertion`) must be sent to a server-side component which performs the token endpoint request and signs assertions when needed. These secrets are used only transiently for the exchange and are not stored by this app (neither in the browser nor on the server).

## Tech stack
- **Framework:** Next.js 16 (App Router, TypeScript)
- **UI Library:** PrimeReact + PrimeFlex + Sass
- **Auth/Crypto:** `jose` (JWT signing/verification)
- **i18n:** `next-intl`
- **Deployment:** Vercel-ready

## Screenshots
Images live in `docs/screenshots/` so they don’t ship with the app. The values shown are demo
configuration — placeholder tenant, client and audience identifiers that belong to no real directory,
and tokens minted by the capture itself against a stubbed provider. Nothing here was issued to
anyone, and nothing in it can be replayed.

Regenerate them with `pnpm screenshots` (see [e2e/screenshots.capture.ts](./e2e/screenshots.capture.ts)).

### Workspaces

1. **Entra workspace landing**

   ![Entra workspace](./docs/screenshots/00-landing.png)

   **Auth0 workspace landing** — the same app, switched with the sidebar selector under the logo

   ![Auth0 workspace](./docs/screenshots/00-landing-auth0.png)

2. **Overview**

   ![Overview](./docs/screenshots/01-overview.png)

3. **Settings** — Entra is tenant-centric

   ![Settings](./docs/screenshots/02-settings.png)

   **Settings** — Auth0 is issuer- and audience-centric, and settings are stored per workspace

   ![Auth0 settings](./docs/screenshots/02-settings-auth0.png)

4. **PKCE** (Authorization Code flows)

   ![PKCE Generator](./docs/screenshots/03-pkce.png)

5. **Authorize** (Authorization Code flows)

   ![Authorize](./docs/screenshots/04-authorize.png)

   **Authorize** — Auth0 adds its own authorization parameters and Rich Authorization Requests

   ![Auth0 authorize](./docs/screenshots/04-authorize-auth0.png)

   **Authorize** — the Auth0 confidential client also picks a request mode: URL, PAR, JAR or
   PAR + JAR. Shown here on PAR + JAR, which signs the parameters into a request object, pushes
   it to Auth0 and launches with the returned `request_uri`

   ![Auth0 confidential authorize](./docs/screenshots/04-authorize-auth0-confidential.png)

6. **Callback** (Authorization Code flows)

   ![Callback](./docs/screenshots/05-callback.png)

7. **Client Authentication** (Confidential Clients)

   ![Client Authentication](./docs/screenshots/06-authentication.png)

8. **Token**

   ![Token Exchange](./docs/screenshots/07-tokens.png)

9. **Decode Tokens**

   ![Decode Tokens](./docs/screenshots/08-decode.png)

10. **Validate Tokens**

   ![Validate Tokens](./docs/screenshots/09-validate.png)

11. **Call API / Test Token**

   ![Call API](./docs/screenshots/10-call-api.png)

### Shared tools

12. **JWT Decoder** — available from both workspaces, and it also reads compact JWEs

   ![JWT Decoder](./docs/screenshots/11-jwt-decoder.png)

13. **Claim descriptions** — descriptions and reference links follow the active workspace

   ![Claim descriptions](./docs/screenshots/12-claim-descriptions.png)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for the recommended workflow and PR checklist.

## Getting Started

1. **Install dependencies:**
   ```sh
   pnpm install
   ```

2. **Run the development server:**
   ```sh
   pnpm dev
   ```

3. **Open the app:**
   Visit [https://localhost:3000](https://localhost:3000). The app effectively handles locale redirection (e.g., to `/en`).
   Provider workspaces are available under `/entra` and `/auth0`.

4. **Build for production:**
   ```sh
   pnpm build
   ```

## Testing

```sh
pnpm lint             # ESLint
pnpm test             # unit tests (Vitest) over the pure library modules
pnpm e2e:offline      # end-to-end, no credentials needed
pnpm e2e:live         # end-to-end against real tenants
pnpm e2e              # both Playwright projects
pnpm provision:auth0  # configure an Auth0 tenant for pnpm e2e:live
```

The end-to-end suites need browsers once per machine:

```sh
npx playwright install chromium
```

`pnpm e2e:offline` contacts no identity provider — it stubs one, including a full
authorization-code round trip — so it is safe to run anywhere and takes well under a
minute. `pnpm e2e:live` drives real applications and needs a `.env.e2e.local`; every
spec skips itself with a named reason when its credentials are absent, so a partial
configuration is fine.

`pnpm provision:auth0` brings an Auth0 tenant to the state those live specs expect —
API, applications, credentials, grants, connection and test user — and writes the
matching values into `.env.e2e.local`. It is idempotent, never deletes anything, and
takes `--dry-run`. It needs a Management API token; see
[e2e/README.md](./e2e/README.md#pnpm-provisionauth0).

[e2e/README.md](./e2e/README.md) covers what each suite proves, what to provision in
Entra and Auth0, and the provider settings that are easy to get wrong.

## Run with Docker

The Docker image runs over HTTP.

Run:
```sh
docker run --rm -p 3000:3000 edipal/entra-oauth-playground:latest
```

Open:
- `http://localhost:3000`

Safari note:
- During sign-in, the browser usually starts on an `https://` Entra page and then redirects to your local callback.
- In Safari (especially with HTTPS-Only enabled), this `https -> http://localhost` redirect can be blocked (`WebKitErrorDomain:305`).
- Similar behavior can also happen in other browsers when HTTPS-Only / strict HTTPS modes are enabled.
- If callback fails, try Chrome or Edge with default settings for local testing.

## Usage

1. **Register an App:** Create an application/client in Microsoft Entra ID or Auth0.
2. **Configure Redirect URI:** Add `https://localhost:3000/callback/auth-code` (or your deployed URL). For Entra public clients, add it under the **Single-page application** platform; for Entra confidential clients, add it under the **Web** platform. For Auth0, add the same URL to the **Allowed Callback URLs** list.
3. **Choose the Provider Workspace:** Use the sidebar selector under the logo to switch between Microsoft Entra ID and Auth0. Settings are stored separately per provider in browser local storage.
4. **Enter Provider Details:**
   - For Entra, enter the directory tenant GUID.
   - For Auth0, enter the tenant issuer URL, for example `https://your-tenant.auth0.com`.
5. **Start the Playground:**
    - Go to **Settings** in the app.
   - Enter your **Client ID** and the provider-specific tenant or issuer value.
   - Select your desired **Scopes**. For Auth0 API tokens and client credentials, set an **Audience** when your API requires one.
   - For Auth0 authorization-code flows, Rich Authorization Requests (`authorization_details`) are available to both client types. Pushed Authorization Requests (PAR) and JWT-secured Authorization Requests (JAR) are offered in the **confidential** flow only — Auth0 authenticates the push, which a public client cannot do — and both need the Highly Regulated Identity add-on on the tenant. JAR additionally needs a signing key, which the Authorize step collects.
6. **Follow the Steps:** Click the "Next" button to progress through the steps.
