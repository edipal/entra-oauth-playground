# Design: Auth0 DPoP (Demonstrating Proof of Possession - RFC 9449) Support

## 1. Background and Motivation
RFC 9449 ("OAuth 2.0 Demonstrating Proof-of-Possession at the Application Layer") specifies a mechanism for sender-constraining OAuth 2.0 tokens using application-level asymmetric cryptography. Unlike standard bearer tokens, which can be replayed by any bearer if intercepted, DPoP-bound tokens require the presenter to prove possession of a private key corresponding to the public key bound to the token.

Auth0 supports DPoP for:
- Binding authorization codes to client keys via `dpop_jkt` at `/authorize` (including Pushed Authorization Requests / PAR and JWT Secured Authorization Requests / JAR).
- Issuing DPoP-bound access tokens and refresh tokens at `/oauth/token` with `token_type: "DPoP"` and a confirmation claim `cnf.jkt` in the access token.
- Validating DPoP proofs when accessing protected APIs (e.g. `/userinfo` or custom APIs) via `Authorization: DPoP <access_token>` and `DPoP: <proof_jwt>` headers.
- Enforcing dynamic freshness using `DPoP-Nonce` challenges.

This design adds end-to-end DPoP support for all Auth0 flows in `entra-oauth-playground`, highlighting every step for educational clarity and verifying correctness with automated unit, offline, and live Playwright E2E tests.

---

## 2. Scope of Flows
DPoP support will be added across all three Auth0 flows in the playground:
1. **Authorization Code Flow (Public Client / SPA)**: Client-side key generation, `dpop_jkt` authorization binding, direct browser `/oauth/token` exchange with DPoP proof, and DPoP API access.
2. **Authorization Code Flow (Confidential Client / Web App)**: Client-side key generation, `dpop_jkt` binding (URL, PAR, JAR, PAR+JAR), backend exchange forwarding `dpopProof` to Auth0, and browser DPoP API access.
3. **Client Credentials Flow (Machine-to-Machine / M2M)**: Client-side key generation, token exchange forwarding `dpopProof` to Auth0, and browser DPoP API access.

---

## 3. Architecture & Core Cryptographic Engine (`src/lib/dpop.ts`)

A dedicated library `src/lib/dpop.ts` built with `jose` and the Web Crypto API, portable across browser and Node.js:

### 3.1. Key Pair Generation & Thumbprint
* **Algorithm**: `ES256` (ECDSA using the P-256 curve and SHA-256 hash).
* **`generateDPoPKeyPair()`**:
  Generates an `ES256` CryptoKey pair `{ privateKey, publicKey }` with `extractable: true`.
* **`exportDPoPPublicJWK(key: CryptoKey)`**:
  Exports the public key to a clean JWK object containing only `{ kty: "EC", crv: "P-256", x, y }`.
* **`calculateDPoPThumbprint(jwk: jose.JWK)`**:
  Calculates the canonical SHA-256 JWK Thumbprint per RFC 7638 (`dpop_jkt`) using `jose.calculateJwkThumbprint(jwk, "sha256")`.

### 3.2. Access Token Hash (`ath`)
* **`calculateAccessTokenHash(accessToken: string)`**:
  Computes the base64url-encoded SHA-256 hash of the ASCII access token per RFC 9449 §4.1:
  `ath = base64url(SHA-256(ASCII(accessToken)))`.

### 3.3. DPoP Proof JWT Generation
* **`createDPoPProof(params)`**:
  * **Header**:
    ```json
    {
      "typ": "dpop+jwt",
      "alg": "ES256",
      "jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." }
    }
    ```
  * **Payload**:
    ```json
    {
      "jti": "<unique-uuid-or-random-string>",
      "htm": "POST | GET",
      "htu": "https://tenant.eu.auth0.com/oauth/token",
      "iat": 1725634800,
      "ath": "<base64url-access-token-hash-if-calling-api>",
      "nonce": "<server-provided-dpop-nonce-if-available>"
    }
    ```
  * Signs the JWT using `jose.SignJWT` with the client's `privateKey`.

---

## 4. State Management (`src/components/SettingsContext.tsx`)

### 4.1. Persisted Configuration
Added to `AuthCodePublicClientConfig`, `AuthCodeConfidentialClientConfig`, and `ClientCredentialsConfig`:
* `dpopEnabled?: boolean` (defaults to `false`).

### 4.2. Runtime State
Added to `AuthCodePublicClientRuntime`, `AuthCodeConfidentialClientRuntime`, and `ClientCredentialsRuntime`:
* `dpopKeyPair?: { privateKey: CryptoKey; publicKey: CryptoKey }`
* `dpopPublicJwk?: jose.JWK`
* `dpopJkt?: string`
* `serverDPoPNonce?: string`
* `lastTokenDPoPProof?: string`
* `lastApiDPoPProof?: string`

---

## 5. Protocol Integration Across Steps

### 5.1. Authorization Request (`StepAuthorize.tsx` & `StepAuthorizationRequestOptions.tsx`)
When `dpopEnabled` is true for an Auth Code flow:
* **URL Mode**: Appends `dpop_jkt=<dpopJkt>` to the query string of the authorization URL.
* **PAR Mode**: Injects `dpop_jkt` into the `application/x-www-form-urlencoded` body posted to `/oauth/par`.
* **JAR Mode**: Injects `"dpop_jkt": "<dpopJkt>"` into the claims of the signed Request Object JWT.
* **PAR + JAR Mode**: Included in both the signed Request Object and PAR parameters.
* **UI**: Renders `dpop_jkt` with copy button and explains its RFC 9449 §10 authorization code binding function.

### 5.2. Token Exchange (`StepTokens.tsx` & Backend Routes)
* **Public Client Flow**:
  * Browser generates DPoP proof for `htm: "POST"`, `htu: tokenEndpoint`, and optional `nonce`.
  * Passes `headers: { "DPoP": dpopProof, "Content-Type": "application/x-www-form-urlencoded" }` directly to Auth0 `/oauth/token`.
* **Confidential Client & Client Credentials Flows**:
  * Browser generates DPoP proof for the resolved `tokenEndpoint`.
  * Passes `dpopProof: string` in the JSON request body to `/api/oauth/auth0/exchange-token` and `/api/oauth/auth0/client-credentials`.
  * `src/lib/oauthTokenHandlers.ts` forwards `DPoP: dpopProof` in the upstream POST to Auth0 `/oauth/token`.
  * Any `DPoP-Nonce` header in Auth0's response is forwarded back to the client.
* **UI**:
  * Displays preview of the DPoP HTTP Header and the decoded DPoP Proof JWT (header with embedded JWK, payload with claims).
  * Highlights `token_type: "DPoP"` in the response.

### 5.3. DPoP-Nonce Challenge & Automatic Retry
Per RFC 9449 §4.3:
* If the server responds with HTTP 400 and `error: "use_dpop_nonce"` (or HTTP 401 with `error: "use_dpop_nonce"` from resource server) with a `DPoP-Nonce: <nonce>` response header:
  1. Client extracts the nonce and saves it to `serverDPoPNonce`.
  2. Generates a fresh DPoP proof JWT including the `"nonce": "<nonce>"` claim.
  3. Retries the request automatically once.
  4. Displays an educational banner: *"Server issued DPoP-Nonce challenge; refreshed proof with nonce and retried successfully."*

### 5.4. Decode & Validation (`StepDecode.tsx` & `StepValidate.tsx`)
* **StepDecode**:
  * Decodes access token and inspects confirmation claim `cnf`.
  * Renders `cnf.jkt` with explanation of public key binding.
* **StepValidate**:
  * Checks `token_type === "DPoP"`.
  * Verifies `access_token.cnf.jkt === client.dpopJkt`.
  * Displays a dedicated DPoP validation status card with green checkmark when thumbprints match.

### 5.5. Protected API Request (`StepCallApi.tsx`)
When `dpopEnabled` is true:
* Changes authorization header to: `Authorization: DPoP <accessToken>`.
* Generates an API DPoP proof:
  * `htm`: `"GET"`
  * `htu`: `apiEndpointUrl`
  * `ath`: `calculateAccessTokenHash(accessToken)`
  * `nonce`: `serverDPoPNonce` (if previously received)
* Attaches `DPoP: <apiDPoPProof>` to request headers.
* Handles API nonce challenge: if API returns 401 with `DPoP-Nonce`, captures nonce, creates new proof, and retries once.
* Displays preview of both `Authorization` and `DPoP` headers, plus the decoded API DPoP proof.

---

## 6. Educational UI Polish
* **`StepSettings`**:
  * "Enable DPoP (RFC 9449)" toggle with contextual explanation tooltip.
  * When active: expandable panel showing Key algorithm (`ES256`), Curve (`P-256`), Public Key JWK (expandable), and JWK Thumbprint (`dpop_jkt`).
  * "Regenerate Key" button to test key rotation or mismatch scenarios.
* **Interactive Tooltips**:
  * Links to RFC 9449 and Auth0 documentation explaining why sender-constraining prevents token interception and replay.

---

## 7. Testing & Verification Plan

### 7.1. Unit Tests (`tests/dpop.test.ts`)
* `generateDPoPKeyPair`: verifies generated key algorithm and curve.
* `exportDPoPPublicJWK`: ensures private key parameters (`d`) are never present in public JWK.
* `calculateDPoPThumbprint`: tests against RFC 7638 standard test vectors.
* `calculateAccessTokenHash`: tests against RFC 9449 §4.1 example vectors.
* `createDPoPProof`: verifies header (`typ: "dpop+jwt"`, `alg: "ES256"`, `jwk`), required claims (`jti`, `htm`, `htu`, `iat`), and optional claims (`ath`, `nonce`).
* DPoP proof verification with `jose.jwtVerify`.

### 7.2. Offline E2E Tests (`e2e/dpop.offline.spec.ts`)
* Configures mocked browser routes with Playwright.
* Verifies `dpop_jkt` parameter injection across URL, PAR, and JAR modes.
* Verifies token request includes `DPoP` header and decodes DPoP proof correctly.
* Verifies DPoP-Nonce retry loop when stub returns `use_dpop_nonce` HTTP 400.
* Verifies StepValidate shows valid DPoP thumbprint confirmation.
* Verifies StepCallApi generates `Authorization: DPoP` and `DPoP` headers with `ath`.

### 7.3. Live E2E Tests against Real Auth0 Tenant
* **`e2e/auth-code-auth0.live.spec.ts`**:
  * **Public Client with DPoP**:
    1. Seed settings with `dpopEnabled: true`.
    2. Interactive popup login on Auth0 with `dpop_jkt` in authorize request.
    3. Direct browser code exchange at `/oauth/token` with DPoP proof.
    4. Assert `token_type === "DPoP"`.
    5. Assert `access_token.cnf.jkt` equals client's `dpop_jkt`.
    6. Call Auth0 `/userinfo` with `Authorization: DPoP` and DPoP proof.
    7. Assert 200 OK and response contains `sub`.
  * **Confidential Client with DPoP**:
    1. Seed settings with `dpopEnabled: true` and client secret.
    2. Popup login and code exchange through `/api/oauth/auth0/exchange-token` with `dpopProof`.
    3. Assert `token_type === "DPoP"` and `cnf.jkt` binding.
    4. Call `/userinfo` with DPoP proof and assert 200 OK.
* **`e2e/client-credentials.live.spec.ts`**:
  * **M2M with DPoP**:
    1. Seed settings with `dpopEnabled: true`.
    2. Execute client credentials flow through `/api/oauth/auth0/client-credentials` with `dpopProof`.
    3. Assert `token_type === "DPoP"` and `cnf.jkt` in access token.
