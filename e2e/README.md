# End-to-end tests

Two Playwright projects, both runnable locally. There is no CI wiring; everything
below is `pnpm` on your machine.

```bash
pnpm e2e:offline   # no credentials needed
pnpm e2e:live      # real tenants, skips whatever is not configured
pnpm e2e           # both
pnpm e2e:ui        # interactive runner
pnpm screenshots   # regenerate docs/screenshots
```

The dev server is started automatically (`pnpm dev`, https://localhost:3000) and an
already-running one is reused.

A third project, `screenshots`, regenerates the README images from
[`screenshots.capture.ts`](screenshots.capture.ts) using the same stubbed provider as
the offline suite. It skips itself unless `E2E_CAPTURE` is set, so a plain `pnpm e2e`
never rewrites them.

## Test files overview

The test suite is partitioned into two Playwright projects, plus support helpers:

### Offline specs (`pnpm e2e:offline`)
Fast (< 1 min), hermetic, runs entirely locally with zero credentials or internet access:
- [`authorize-request.offline.spec.ts`](authorize-request.offline.spec.ts) — Asserts the authorize URL the app constructs across all provider/client/PKCE/prompt/RAR configurations.
- [`auth-request-modes.offline.spec.ts`](auth-request-modes.offline.spec.ts) — Exercises Auth0 request modes (URL, PAR, JAR, PAR + JAR) in the browser UI with stubbed backend routes.
- [`auth-request-routes.offline.spec.ts`](auth-request-routes.offline.spec.ts) — Tests the `/api/oauth/auth0/par` and `/api/oauth/auth0/request-object` API routes directly over HTTP (SSRF allowlist, param validation).
- [`token-routes.offline.spec.ts`](token-routes.offline.spec.ts) — Tests the four server-side token exchange API routes directly over HTTP (input validation, missing secrets/keys, tenant mismatch refusals).
- [`client-auth.offline.spec.ts`](client-auth.offline.spec.ts) — Tests the Client Authentication step UI gating (certificate + `x5t` for Entra vs private key + `kid` for Auth0).
- [`token-decode.offline.spec.ts`](token-decode.offline.spec.ts) — Full mock authorization code round-trip: discovery, popup, code exchange, and token decoding/validation against stubbed JWKS and edge-case tokens (expired, tampered, compact JWE).
- [`settings-isolation.offline.spec.ts`](settings-isolation.offline.spec.ts) — Verifies workspace settings isolation between Entra and Auth0 so neither can overwrite or read the other's state.
- [`labels.offline.spec.ts`](labels.offline.spec.ts) — Asserts provider-specific terminology and form labels in the UI.

### Live specs (`pnpm e2e:live`)
Round trips against real identity provider cloud tenants using `.env.e2e.local` (specs auto-skip when their credentials are missing):
- [`client-credentials.live.spec.ts`](client-credentials.live.spec.ts) — Headless M2M client credentials flows (client secret and `private_key_jwt`) against real Entra and Auth0 tenants.
- [`auth-code-entra.live.spec.ts`](auth-code-entra.live.spec.ts) — Real browser round-trips against Microsoft Entra (public/confidential, PKCE, no-PKCE refusal, `form_post`, certificate auth, streamlined mode).
- [`auth-code-auth0.live.spec.ts`](auth-code-auth0.live.spec.ts) — Real browser round-trips against Auth0 (public/confidential, PKCE, no-PKCE acceptance, PAR, JAR, PAR+JAR, RAR, streamlined mode).

### Setup and support
- [`warmup.setup.ts`](warmup.setup.ts) — Pre-compiles Next.js routes once before parallel workers launch.
- [`screenshots.capture.ts`](screenshots.capture.ts) — Generates documentation screenshots from stubbed flows when `E2E_CAPTURE` is set.
- `support/` — Reusable test helpers: [`stubProvider.ts`](support/stubProvider.ts) (mock IDP), [`signin.ts`](support/signin.ts) (provider login selectors), [`flow.ts`](support/flow.ts) (page object), [`settings.ts`](support/settings.ts) (defaults & seeding), [`credentials.ts`](support/credentials.ts) (env resolution).

## offline

Everything provable without contacting an identity provider:

- the authorization request the app builds for every configuration — both routes,
  both providers, PKCE on and off, every prompt and `response_mode` ([`authorize-request.offline.spec.ts`](authorize-request.offline.spec.ts))
- the Auth0 parameter surface and its dependent-field disclosure rules ([`authorize-request.offline.spec.ts`](authorize-request.offline.spec.ts))
- Rich Authorization Requests validation, and the compacted JSON that reaches the wire ([`authorize-request.offline.spec.ts`](authorize-request.offline.spec.ts))
- the client-authentication step's per-provider gating: certificate + thumbprint for
  Entra, a `kid` for Auth0 ([`client-auth.offline.spec.ts`](client-auth.offline.spec.ts))
- every Auth0 request mode — URL, PAR, JAR and PAR + JAR — with the two server routes
  and the provider stubbed ([`auth-request-modes.offline.spec.ts`](auth-request-modes.offline.spec.ts))
- those two server routes' own refusals, driven over HTTP with no browser ([`auth-request-routes.offline.spec.ts`](auth-request-routes.offline.spec.ts))
- the four token-exchange server routes' refusals and parameter validation over direct HTTP ([`token-routes.offline.spec.ts`](token-routes.offline.spec.ts))
- workspace settings isolation: two providers configured side by side, neither able
  to read, overwrite or impersonate the other ([`settings-isolation.offline.spec.ts`](settings-isolation.offline.spec.ts))
- decoding and validating tokens the app is handed, against a stubbed tenant ([`token-decode.offline.spec.ts`](token-decode.offline.spec.ts))
- provider-specific labels and descriptions in the UI ([`labels.offline.spec.ts`](labels.offline.spec.ts))

Most of these assert the URL the app _would_ open, or the body it _would_ post. That
is where nearly every provider- and option-specific decision lands, so the matrix is
exhaustive here rather than in the live suite. Runs in well under a minute and needs
no setup beyond `npx playwright install chromium`.

### Round trips without a provider

[`token-decode.offline.spec.ts`](token-decode.offline.spec.ts) runs a whole
authorization code flow with no identity provider at all:
[`support/stubProvider.ts`](support/stubProvider.ts) answers discovery, redirects
`/authorize` straight back to the app's own callback with a code, and mints the token
response. Everything between — the popup, the callback page, the `postMessage` to the
opener, the exchange and the signature check against the advertised JWKS — is the
app's real code.

That makes the tokens ours to shape, which is the point: encrypted (a compact JWE),
expired, bound to another request's `nonce`, or signed by a key the JWKS never
published. A live tenant will not issue those on request.

Two things to know before adding to it. Stub the **exact** provider paths, never the
whole origin — a wildcard on the issuer also swallows
`/.well-known/openid-configuration`, and without it the Auth0 workspace cannot resolve
its endpoints or leave the Settings step, which presents as a series of unrelated
"Next is disabled" failures. And Auth0 serves discovery for _any_ subdomain, so a spec
that skips the stub still gets a working document, quietly over the internet.

## live

Real round trips against real cloud tenants. Each spec skips itself with a named reason
when its credentials are absent, so a partial `.env.e2e.local` is fine — configure Auth0
only, and the Entra specs simply skip.

That convenience has a sharp edge: a run in which *every* spec skipped itself still
exits 0, and looks exactly like a run that passed. Set `E2E_REQUIRE_LIVE=1` when the
run is supposed to reach a tenant — a CI job, or a check before release — and a
missing credential fails the spec that wanted it instead of quietly skipping:

```sh
E2E_REQUIRE_LIVE=1 pnpm e2e:live
```

The check lives in `requires()` in [`support/credentials.ts`](support/credentials.ts),
inside the test. [`support/liveSummaryReporter.ts`](support/liveSummaryReporter.ts)
prints the ran/skipped tally, but it cannot be the guard: passing `--reporter=` on the
command line replaces the reporter list from `playwright.config.ts` and drops it
without a word.

- **Headless M2M**: [`client-credentials.live.spec.ts`](client-credentials.live.spec.ts)
- **Interactive Entra**: [`auth-code-entra.live.spec.ts`](auth-code-entra.live.spec.ts)
- **Interactive Auth0**: [`auth-code-auth0.live.spec.ts`](auth-code-auth0.live.spec.ts)

```bash
cp .env.e2e.example .env.e2e.local   # then fill it in; it is gitignored
```

**Client-credentials specs are headless and reliable.** The authorization-code
specs drive Microsoft's and Auth0's own sign-in pages, so they need a test user
with **MFA and Conditional Access disabled** and they are inherently more fragile —
provider login markup changes without notice. All of that markup lives in one
place, [`support/signin.ts`](support/signin.ts), so a redesign is a one-file fix.

## What to provision

### Microsoft Entra

1. **Public client app** — redirect URI `https://localhost:3000/callback/auth-code`
   under the **Single-page application** platform.
2. **Confidential client app** — the same redirect URI under the **Web** platform,
   plus a client secret. For the `private_key_jwt` specs, upload a certificate and
   put the matching private key and its base64url SHA-1 thumbprint (`x5t`) in the
   env file.
3. **API permissions** — `User.Read` delegated for the user flows; an application
   permission with admin consent granted for client credentials, otherwise the
   `.default` scope returns a token with nothing in it.
4. **Test user** — cloud-only, excluded from MFA and any Conditional Access policy.

### Auth0

Either run [`pnpm provision:auth0`](#pnpm-provisionauth0), which does all of the
below, or follow the steps by hand.

#### `pnpm provision:auth0`

Brings a tenant to the state the live specs expect, then writes the matching values
into `.env.e2e.local`:

```bash
AUTH0_DOMAIN=your-tenant.eu.auth0.com \
AUTH0_MGMT_TOKEN_FILE=/path/to/token \
pnpm provision:auth0 --dry-run
```

It converges, in order: tenant settings (_Allow PAR_), the API and its `read:orders`
scope and `payment_initiation` RAR type, the four applications, the private_key_jwt credential assigned to **both**
client authentication and `signed_request_object`, the `user` and `client` grants
each application needs, the database connection, and the test user. Then it writes
18 `E2E_AUTH0_*` keys into `.env.e2e.local`, plus the two password keys when the
password is known — which is only when the user was just created, since no API can
read a password back.

- **Idempotent.** It only creates and patches — it never deletes, so anything it does
  not know about is left alone. Run it against a new tenant to build everything, or
  against a configured one to converge it. The final line distinguishes
  `nothing to change — the tenant already matches` from `N change(s) applied`.
- **`--dry-run`** prints the same diff and changes nothing. Worth doing first against
  a tenant that already has applications on it.
- **The token** comes from _Dashboard → Applications → APIs → Auth0 Management API →
  API Explorer_, and needs read/create/update on `clients`, `client_credentials`,
  `client_grants`, `connections`, `resource_servers`, `users` and `tenant_settings`.
  It is read from a **file** rather than an argument, so it stays out of shell
  history; `AUTH0_MGMT_TOKEN` works too if you would rather pass it directly.
- **It writes secrets.** `.env.e2e.local` is created at mode `0600` and is
  gitignored. The private key lands in `certificates/auth0-e2e-private.pem`, also
  gitignored. Only the keys it owns are rewritten, so Entra configuration in the same
  file survives untouched.

Overridable with `E2E_REDIRECT_URI`, `E2E_AUTH0_API_IDENTIFIER`,
`E2E_AUTH0_CONNECTION` and `E2E_AUTH0_TEST_USER`.

#### By hand

Do these in order; the API has to exist before the applications can be authorized
against it.

1. **API** — _Applications → APIs → Create API_. The **Identifier** you choose
   becomes `E2E_AUTH0_AUDIENCE`; it is just a URI and does not have to resolve.
   Signing algorithm RS256. Optionally enable **RBAC** and **Add Permissions in the
   Access Token**, then add permissions such as `read:orders`, to exercise the
   `permissions` claim.

   Without a custom API audience Auth0 returns an **opaque, encrypted token**
   (a compact JWE) rather than a readable JWT — which is exactly the token the
   decode step reports as encrypted. Requesting this audience is what produces an
   inspectable access token.

2. **Single Page Application** — _Applications → Create Application → Single Page
   Web Applications_. Set:
   - **Allowed Callback URLs**: `https://localhost:3000/callback/auth-code`
   - **Allowed Web Origins**: `https://localhost:3000`

   The web origin is required: in the public-client flow the browser posts the code
   to `/oauth/token` itself, so without it the exchange fails CORS.

   Then **authorize it against the API** from step 1 — see _Authorizing an
   application against the API_ below. This is easy to skip because it reads like
   something only machine-to-machine clients need.

3. **Regular Web Application** — same callback URL. The exchange happens server
   side here, so no web origin is needed. Copy the client secret. **Authorize it
   against the API** as well.

4. **Machine to Machine Application** — authorize it for the API from step 1 and
   grant the permissions you want in the token.

   **Authorizing an application against the API.** Every application that will ask
   for this audience needs a grant against it — the SPA and the Regular Web
   Application included, even though their flows are user-delegated. Without one
   Auth0 refuses the authorization request outright with `Client ... is not
authorized to access resource server ...`, **before any login form appears**, which
   looks like a bad client id or callback rather than a missing grant.

   Grants carry a **subject type**, and the two are not interchangeable:

   | subject type | authorizes                                          | applications here      |
   | ------------ | --------------------------------------------------- | ---------------------- |
   | `user`       | tokens issued for a signed-in user (auth code flow) | SPA, Regular Web App   |
   | `client`     | the client credentials flow                         | Machine to Machine     |

   An application that does both needs **both** grants — which is the case for the
   private_key_jwt application in step 6, since one application there serves the
   user flows and client credentials. `pnpm provision:auth0` creates exactly these;
   by hand, the dashboard's _APIs → your API → Machine To Machine Applications_ list
   is where the authorization lives, or `POST /api/v2/client-grants` with an
   explicit `subject_type`.

5. **Test user** — _User Management → Users → Create User_ on the
   `Username-Password-Authentication` connection, with MFA off. Make sure that
   connection is enabled for the SPA and Regular Web App.

6. **Private Key JWT** (optional) — this needs **two more applications**, not a
   change to the ones above. Auth0 makes the token-endpoint authentication method
   exclusive per application, so switching an existing application to Private Key
   JWT hides its client secret and breaks the client-secret specs. They live on the
   same tenant as everything else; the `E2E_AUTH0_PKJWT_*` values exist only for a
   tenant that cannot host them, and each falls back to its single-tenant
   equivalent.

   Create a **Machine to Machine** application and a **Regular Web Application**
   (callback `https://localhost:3000/callback/auth-code`,
   `Username-Password-Authentication` enabled, both **authorized against the API** —
   the Regular Web Application needs a `user`-subject grant *and* a `client`-subject
   one, because it serves the user flows and client credentials both), then for
   **each**:
   - _Credentials → **Authentication Methods** → Private Key JWT_, and **save**.
     This is the step that is easy to miss: adding a credential does **not** switch
     the method, and an application left on Client Secret answers
     `401 invalid_client` for every assertion no matter how correct it is. The
     confirmation is that the Client Secret disappears from the Settings tab.
   - _Credentials → Add Credential_ → paste the **public** key in PEM form, RS256.

   Then fill `E2E_AUTH0_PRIVATE_KEY_PEM`, `E2E_AUTH0_PKJWT_M2M_CLIENT_ID` and
   `E2E_AUTH0_PKJWT_CLIENT_ID`. One tenant carries both applications, and both
   `private_key_jwt` specs pass in the same run — register **the same public key**
   on each. `pnpm provision:auth0` does all of this.

   The credential's **Key ID** is shown in the Credentials tab (and returned by
   `GET /api/v2/clients/{client_id}/credentials`) — put it in
   `E2E_AUTH0_CREDENTIAL_KID`. It is the RFC 7638 JWK thumbprint of the public key,
   so the same key registered on several applications produces the same `kid` —
   which is why one `E2E_AUTH0_CREDENTIAL_KID` covers both applications.

   The remaining `E2E_AUTH0_PKJWT_*` variables are an escape hatch, not the
   expected setup: `E2E_AUTH0_PKJWT_ISSUER_URL`, `E2E_AUTH0_PKJWT_AUDIENCE`,
   `E2E_AUTH0_PKJWT_API_ENDPOINT`, `E2E_AUTH0_PKJWT_USERNAME` and
   `E2E_AUTH0_PKJWT_PASSWORD` each fall back to their single-tenant equivalent
   (see [`support/credentials.ts`](support/credentials.ts)), so they only need
   values when a tenant cannot host everything and the private_key_jwt
   applications have to live elsewhere. That second tenant would need its own API
   and its own test user, because a round trip cannot straddle two tenants.

   A second tenant would need its own API authorization too, on the same terms as
   step 4 — see _Authorizing an application against the API_.

   The client-authentication step asks Auth0 users for a private key and a `kid`
   only — no certificate, because Auth0 stores the public key itself.

   On the assertion `aud`, measured against a live tenant: the tenant URL **with**
   its trailing slash and the token endpoint are both accepted; the issuer
   **without** the trailing slash is rejected with `invalid_client`. The app sends
   the trailing-slash form, which is what Auth0 documents.

7. **PAR / JAR** — needs the Highly Regulated Identity add-on on an Enterprise
   plan, and three separate pieces of configuration. Getting any one of them wrong
   produces a bare `400` with no explanation, so do them in this order.
   `pnpm provision:auth0` does all three; the manual steps are below for a tenant
   you would rather configure by hand.
   1. **Tenant** — _Settings → Advanced → **Allow** Pushed Authorization Requests_.
      This is what publishes the `/oauth/par` endpoint. Verify:

      ```bash
      curl -s "$ISSUER/.well-known/openid-configuration" | grep pushed_authorization
      ```

   2. **Assign a credential to `signed_request_object`.** The credential already
      registered for Private Key JWT serves here too — one credential, assigned
      twice, which matters because an application has only two credential slots.
      What Auth0 requires is the *assignment*, not a second key: without it the
      answer is `invalid_request_object: Client has no associated credentials for
signed JWT`, whatever credentials the application holds.

      Assign it with `required: false` so JAR is accepted but not mandatory — the
      dashboard toggle sets `required: true`, which breaks every non-JAR spec:

      ```bash
      # the credential registered earlier for private_key_jwt — the first one
      # listed, which is the only one on an application this script set up
      CRED_ID=$(curl -s "$ISSUER/api/v2/clients/$CLIENT_ID/credentials" \
        -H "authorization: Bearer $TOKEN" \
        | python3 -c 'import json,sys;print(json.load(sys.stdin)[0]["id"])')
      curl -s -X PATCH "$ISSUER/api/v2/clients/$CLIENT_ID" \
        -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
        -d "{\"signed_request_object\":{\"required\":false,\"credentials\":[{\"id\":\"$CRED_ID\"}]}}"
      ```

   3. **Leave both per-application _Require_ toggles off** — _Applications → your
      app → Settings → Authorization Requests_. "Allow" is the capability; "Require"
      makes that mode the _only_ one accepted. Turning on _Require PAR_ makes a
      plain URL request fail with `The usage of Pushed Authorization Requests is
required by the configuration`, which takes the URL and JAR specs down with
      it. The toggles are green when on and grey when off.

   Auth0 supports PAR for **confidential clients only**, which is why the app offers
   the request-mode selector on the confidential flow alone.

   One protocol detail that costs an afternoon if missed: the request object's `aud`
   must be the tenant URL **with** its trailing slash. Addressed to the bare issuer,
   `/authorize` answers 400 with no error code — measured, and the reason
   `src/lib/requestObject.ts` signs for `getAuth0TenantAudience` rather than the
   normalized issuer.

## Test coverage matrix: Live vs Offline

### Live coverage today

The matrix below shows where each flow is covered: online against real tenants, offline with stubs and route tests, and in which specific files they reside.

| Flow / Feature | Live (Online): Entra | Live (Online): Auth0 | Offline Spec (Hermetic) | Scope & Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Client credentials, client secret** | [`client-credentials.live.spec.ts`](client-credentials.live.spec.ts) ✅ | [`client-credentials.live.spec.ts`](client-credentials.live.spec.ts) ✅ | [`token-routes.offline.spec.ts`](token-routes.offline.spec.ts)<br>[`client-auth.offline.spec.ts`](client-auth.offline.spec.ts) | **Live:** Real M2M token request and response parsing.<br>**Offline:** Parameter validation, missing secret/tenant refusals, and UI gating. |
| **Client credentials, `private_key_jwt`** | [`client-credentials.live.spec.ts`](client-credentials.live.spec.ts) ✅ (certificate) | [`client-credentials.live.spec.ts`](client-credentials.live.spec.ts) ✅ (public key) | [`token-routes.offline.spec.ts`](token-routes.offline.spec.ts)<br>[`client-auth.offline.spec.ts`](client-auth.offline.spec.ts) | **Live:** Client assertion signed & redeemed on live endpoints.<br>**Offline:** Gating by provider (certificate + `x5t` vs `kid`), server route SSRF protection. |
| **Auth code, public client, PKCE** | [`auth-code-entra.live.spec.ts`](auth-code-entra.live.spec.ts) ✅ | [`auth-code-auth0.live.spec.ts`](auth-code-auth0.live.spec.ts) ✅ | [`authorize-request.offline.spec.ts`](authorize-request.offline.spec.ts)<br>[`token-decode.offline.spec.ts`](token-decode.offline.spec.ts) | **Live:** Real interactive login popup, authorization code redemption, token display.<br>**Offline:** Authorize URL query building with `code_challenge` (S256), full mock round trip against stubbed provider. |
| **Auth code, public client, no PKCE** | [`auth-code-entra.live.spec.ts`](auth-code-entra.live.spec.ts) ✅ (refusal pinned) | [`auth-code-auth0.live.spec.ts`](auth-code-auth0.live.spec.ts) ✅ (succeeds) | [`authorize-request.offline.spec.ts`](authorize-request.offline.spec.ts) | **Provider difference:** Entra rejects SPA without PKCE (`AADSTS9002325`); Auth0 accepts it. Both behaviors are pinned live. Offline verifies `code_challenge` omission. |
| **Auth code, confidential, secret, PKCE** | [`auth-code-entra.live.spec.ts`](auth-code-entra.live.spec.ts) ✅ | [`auth-code-auth0.live.spec.ts`](auth-code-auth0.live.spec.ts) ✅ | [`authorize-request.offline.spec.ts`](authorize-request.offline.spec.ts)<br>[`token-routes.offline.spec.ts`](token-routes.offline.spec.ts) | **Live:** Real popup login + server-side code exchange via secret.<br>**Offline:** URL building for confidential route; `/api/oauth/<provider>/exchange-token` route tests. |
| **Auth code, confidential, secret, no PKCE** | [`auth-code-entra.live.spec.ts`](auth-code-entra.live.spec.ts) ✅ | [`auth-code-auth0.live.spec.ts`](auth-code-auth0.live.spec.ts) ✅ | [`authorize-request.offline.spec.ts`](authorize-request.offline.spec.ts)<br>[`token-routes.offline.spec.ts`](token-routes.offline.spec.ts) | **Live:** Real popup login + server exchange without PKCE.<br>**Offline:** URL generation & exchange route validation. |
| **Auth code, confidential, `private_key_jwt`** | [`auth-code-entra.live.spec.ts`](auth-code-entra.live.spec.ts) ✅ (certificate) | [`auth-code-auth0.live.spec.ts`](auth-code-auth0.live.spec.ts) ✅ (registered key) | [`client-auth.offline.spec.ts`](client-auth.offline.spec.ts)<br>[`token-routes.offline.spec.ts`](token-routes.offline.spec.ts) | **Live:** Real popup login + server exchange using signed client assertion JWT.<br>**Offline:** UI gating for certificate vs `kid`; exchange route parameter validation. |
| **`response_mode=form_post`** | [`auth-code-entra.live.spec.ts`](auth-code-entra.live.spec.ts) ✅ | n/a | [`authorize-request.offline.spec.ts`](authorize-request.offline.spec.ts) | **Live:** Entra POSTs code in HTTP request body to callback page.<br>**Offline:** Authorize URL asserts `response_mode=form_post`. |
| **Streamlined mode** | [`auth-code-entra.live.spec.ts`](auth-code-entra.live.spec.ts) ✅ | [`auth-code-auth0.live.spec.ts`](auth-code-auth0.live.spec.ts) ✅ | [`token-decode.offline.spec.ts`](token-decode.offline.spec.ts) | **Live:** Advances through exchange and decode without additional user clicks.<br>**Offline:** Full progression verified in stubbed round trips. |
| **PAR, JAR, PAR + JAR, and RAR** | n/a (Entra lacks PAR/JAR) | [`auth-code-auth0.live.spec.ts`](auth-code-auth0.live.spec.ts) ✅ | [`auth-request-modes.offline.spec.ts`](auth-request-modes.offline.spec.ts)<br>[`auth-request-routes.offline.spec.ts`](auth-request-routes.offline.spec.ts)<br>[`authorize-request.offline.spec.ts`](authorize-request.offline.spec.ts) | **Live:** Real PAR push to `/oauth/par`, JAR signed request objects, RAR `authorization_details`.<br>**Offline:** Browser UI request modes, direct API route tests (`/api/oauth/auth0/par` & `request-object`), compacted RAR JSON validation. |
| **Token decode & validation** | Genuine tokens decoded in live specs | Genuine tokens decoded in live specs | [`token-decode.offline.spec.ts`](token-decode.offline.spec.ts) | **Live:** Real provider JWTs inspected in UI.<br>**Offline:** Negative test matrix a live tenant won't produce on demand: compact JWE encrypted tokens, expired tokens, untrusted JWKS signatures, mismatched state/nonce. |
| **Workspace settings isolation** | Implicit in live runs | Implicit in live runs | [`settings-isolation.offline.spec.ts`](settings-isolation.offline.spec.ts) | **Offline:** Verifies Entra and Auth0 settings cannot overwrite, leak, or impersonate each other in browser storage. |
| **UI labels & localization copy** | Visually verified | Visually verified | [`labels.offline.spec.ts`](labels.offline.spec.ts) | **Offline:** Ensures step titles, labels, and provider terminology match design. |

The no-PKCE row is a real difference between the providers rather than an
inconsistency in the suite: Entra refuses the request outright for a Single-page
application redirect URI, while Auth0 accepts the same configuration. Both
behaviours are pinned.

The two Auth0 `private_key_jwt` rows are verified but not simultaneously — see the
one-credential-per-tenant note above.

The two `private_key_jwt` rows differ in what identifies the signing key, which is
the whole reason they are worth running against both providers: Entra matches the
SHA-1 thumbprint of a certificate (`x5t`) and signs the assertion for the token
endpoint, while Auth0 matches a `kid` it generated for the registered public key
and requires the tenant URL — with its trailing slash — as the assertion `aud`.
Auth0 accepts either the trailing-slash tenant URL or the token endpoint as the
assertion `aud`, but not the issuer without its trailing slash — measured, not
assumed.

The two client types exercise genuinely different code paths and both are covered:
a public client redeems the code **in the browser** against the provider's
CORS-enabled endpoint, while a confidential client redeems it **server-side**
through `/api/oauth/<provider>/exchange-token`.

## Provider errors you may hit

- **`AADSTS9002325`** — expected, and asserted by the no-PKCE spec. Entra requires
  PKCE for redirect URIs registered under the Single-page application platform and
  rejects the authorization request itself, so no code is ever issued.
- **`AADSTS50076`** — a Conditional Access policy is demanding MFA for the resource
  (often Microsoft Graph rather than the app). Unattended sign-in cannot satisfy it.
  It also appears transiently for a few minutes after relaxing such a policy, while
  the change propagates.
- **`AADSTS70008`** — the authorization code expired. Entra's codes are short-lived,
  so this usually means something in the spec stalled between the callback and the
  token request rather than anything being misconfigured.

## Secrets

`.env.e2e.local` is gitignored and must stay that way. Prefer a throwaway tenant
and least-privilege apps; a test user password is a real credential. Rotate the
secrets when you are done experimenting.
