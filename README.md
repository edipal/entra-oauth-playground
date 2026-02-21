# Next.js Entra ID OAuth Playground

[![CodeQL](https://github.com/edipal/entra-oauth-playground/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/edipal/entra-oauth-playground/actions/workflows/github-code-scanning/codeql)

## Disclaimer
This project was created with the assistance of GitHub Copilot. Portions of the code, structure, and documentation were generated and then reviewed/edited by a human. Please validate and test in your environment and review results before relying on them.

This is a proof of concept, not a thoughtfully designed and developed application. It may contain bugs, inefficiencies, and incomplete features.

Ensure appropriate Entra ID security and governance are in place per your organization’s policies.

## Overview
This app helps you explore the most used Microsoft Entra ID OAuth 2.0 flows visually. It breaks down the complex "dance" of modern authentication into discrete, interactive steps.

You can configure your own Entra ID application details, then walk through the process of generating PKCE codes, building authorization URLs, handling callbacks, exchanging codes for tokens, and finally decoding, validating, and testing those tokens.

Supported flows:
- **Authorization Code (Public Client)**
- **Authorization Code (Confidential Client)**
- **Client Credentials (Confidential Client)**

## Confidential client warning - when not running locally
> ⚠️ **Confidential client flows require server-side token exchange.**
>
> Due to browser + Entra ID limitations, secrets (client secrets or private keys used for `client_assertion`) must be sent to a server-side component which performs the token endpoint request and signs assertions when needed. These secrets are used only transiently for the exchange and are not stored by this app (neither in the browser nor on the server).

## Tech stack
- **Framework:** Next.js 16 (App Router, TypeScript)
- **UI Library:** PrimeReact + PrimeFlex + Sass
- **Auth/Crypto:** `jose` (JWT signing/verification)
- **i18n:** `next-intl`
- **Deployment:** Vercel-ready

## Screenshots
Add your own screenshots to replace the placeholders below. Place images in `docs/screenshots/` so they don’t ship with the app.

1. **Landing**

   ![Landing](./docs/screenshots/00-landing.png)

2. **Overview**

   ![Overview](./docs/screenshots/01-overview.png)

3. **Settings**

   ![Settings](./docs/screenshots/02-settings.png)

4. **PKCE** (Authorization Code flows)

   ![PKCE Generator](./docs/screenshots/03-pkce.png)

5. **Authorize** (Authorization Code flows)

   ![Authorize](./docs/screenshots/04-authorize.png)

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

## Getting Started

1. **Install dependencies:**
   ```sh
   npm install
   # or
   pnpm install
   ```

2. **Run the development server:**
   ```sh
   npm run dev
   # or
   pnpm dev
   # or
   npm run start # to run independent of next.js dev mode if needed
   ```

3. **Open the app:**
   Visit [https://localhost:3000](https://localhost:3000). The app effectively handles locale redirection (e.g., to `/en`).

4. **Build for production:**
   ```sh
   npm run build
   ```

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

1. **Register an App:** Go to the [Entra Admin Center](https://entra.microsoft.com/) and register an Application.
2. **Configure Redirect URI:** Add `https://localhost:3000/callback/auth-code` (or your deployed URL). For **public clients**, add it under the **Single-page application** platform; for **confidential clients**, add it under the **Web** platform.
3. **Start the Playground:**
    - Go to **Settings** in the app.
    - Enter your **Client ID** and **Tenant ID**.
    - Select your desired **Scopes**.
4. **Follow the Steps:** Click the "Next" button to progress through the steps.
