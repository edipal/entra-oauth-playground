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

## offline

Everything provable without contacting an identity provider:

- the authorization request the app builds for every configuration — both routes,
  both providers, PKCE on and off, every prompt and `response_mode`
- the Auth0 parameter surface and its dependent-field disclosure rules
- Rich Authorization Requests validation, and the compacted JSON that reaches the wire
- the client-authentication step's per-provider gating (certificate + thumbprint for
  Entra, a `kid` for Auth0)
- every Auth0 request mode — URL, PAR, JAR and PAR + JAR — with the two server routes
  and the provider stubbed
- those two server routes' own refusals, driven over HTTP with no browser
- workspace settings isolation: two providers configured side by side, neither able
  to read, overwrite or impersonate the other
- decoding and validating tokens the app is handed, against a stubbed tenant

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

Real round trips. Each spec skips itself with a named reason when its credentials
are absent, so a partial `.env.e2e.local` is fine — configure Auth0 only, and the
Entra specs simply skip.

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

3. **Regular Web Application** — same callback URL. The exchange happens server
   side here, so no web origin is needed. Copy the client secret.

4. **Machine to Machine Application** — authorize it for the API from step 1 and
   grant the permissions you want in the token.

5. **Test user** — _User Management → Users → Create User_ on the
   `Username-Password-Authentication` connection, with MFA off. Make sure that
   connection is enabled for the SPA and Regular Web App.

6. **Private Key JWT** (optional, and often on its own tenant) — this needs **two
   more applications**, not a change to the ones above. Auth0 makes the
   token-endpoint authentication method exclusive per application, so switching an
   existing application to Private Key JWT hides its client secret and breaks the
   client-secret specs. A tenant also allows only a limited number of application
   credentials, which an established tenant may have spent. Both pressures push
   this setup onto a separate tenant, so every `E2E_AUTH0_PKJWT_*` value falls back
   to its single-tenant equivalent — set only what actually differs.

   Create a **Machine to Machine** application and a **Regular Web Application**
   (callback `https://localhost:3000/callback/auth-code`,
   `Username-Password-Authentication` enabled), then for **each**:
   - _Credentials → **Authentication Methods** → Private Key JWT_, and **save**.
     This is the step that is easy to miss: adding a credential does **not** switch
     the method, and an application left on Client Secret answers
     `401 invalid_client` for every assertion no matter how correct it is. The
     confirmation is that the Client Secret disappears from the Settings tab.
   - _Credentials → Add Credential_ → paste the **public** key in PEM form, RS256.

   Then fill `E2E_AUTH0_PRIVATE_KEY_PEM`, `E2E_AUTH0_PKJWT_M2M_CLIENT_ID`,
   `E2E_AUTH0_PKJWT_CLIENT_ID`, and — when the applications live on another tenant
   — `E2E_AUTH0_PKJWT_ISSUER_URL`, `E2E_AUTH0_PKJWT_AUDIENCE`,
   `E2E_AUTH0_PKJWT_API_ENDPOINT`, `E2E_AUTH0_PKJWT_USERNAME` and
   `E2E_AUTH0_PKJWT_PASSWORD`. That tenant needs its own API and its own test user,
   because the round trip cannot straddle two tenants.

   The credential's **Key ID** is shown in the Credentials tab (and returned by
   `GET /api/v2/clients/{client_id}/credentials`) — put it in
   `E2E_AUTH0_CREDENTIAL_KID`. It is the RFC 7638 JWK thumbprint of the public key,
   so the same key registered on several applications produces the same `kid`.

   > **One credential per tenant.** On the trial tenant used here only a single
   > Private Key JWT credential could be held at a time — the dashboard reports the
   > allowance exhausted ("This tenant reached its available credentials limit")
   > even though it states a limit of four. The practical consequence: the two
   > `private_key_jwt` specs **cannot both pass in one run**. Whichever application
   > holds the credential passes, and the other fails with `invalid_client`, which
   > looks exactly like a misconfiguration but is not one. Move the credential
   > between the M2M and the Regular Web Application to exercise them in turn, or
   > run with `--grep` to select the one you care about. Both have been verified
   > this way; neither is flaky.

   That tenant's API must also list the applications under _APIs → your API →
   Machine To Machine Applications_ — **including the Regular Web Application**.
   Without it Auth0 refuses the authorization request outright with `Client ... is
not authorized to access resource server ...`, before any login form appears,
   even though the flow is user-delegated.

   The client-authentication step asks Auth0 users for a private key and a `kid`
   only — no certificate, because Auth0 stores the public key itself.

   On the assertion `aud`, measured against a live tenant: the tenant URL **with**
   its trailing slash and the token endpoint are both accepted; the issuer
   **without** the trailing slash is rejected with `invalid_client`. The app sends
   the trailing-slash form, which is what Auth0 documents.

7. **PAR / JAR** — needs the Highly Regulated Identity add-on on an Enterprise
   plan, and three separate pieces of configuration. Getting any one of them wrong
   produces a bare `400` with no explanation, so do them in this order:
   1. **Tenant** — _Settings → Advanced → **Allow** Pushed Authorization Requests_.
      This is what publishes the `/oauth/par` endpoint. Verify:

      ```bash
      curl -s "$ISSUER/.well-known/openid-configuration" | grep pushed_authorization
      ```

   2. **A request-object credential on the application**, separate from the Private
      Key JWT credential used for client authentication. Without it Auth0 answers
      `invalid_request_object: Client has no associated credentials for signed JWT`.
      Register it with `required: false` so JAR is accepted but not mandatory — the
      dashboard toggle sets `required: true`, which breaks every non-JAR spec:

      ```bash
      PEM=$(python3 -c 'import json;print(json.dumps(open("certificates/auth0-pkjwt.pub").read()))')
      CRED=$(curl -s -X POST "$ISSUER/api/v2/clients/$CLIENT_ID/credentials" \
        -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
        -d "{\"credential_type\":\"public_key\",\"name\":\"JAR key\",\"pem\":$PEM,\"alg\":\"RS256\"}")
      CRED_ID=$(echo "$CRED" | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')
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

## Live coverage today

| Flow                                       | Entra             | Auth0       |
| ------------------------------------------ | ----------------- | ----------- |
| Client credentials, client secret          | ✅                | ✅          |
| Client credentials, `private_key_jwt`      | ✅                | ✅          |
| Auth code, public client, PKCE             | ✅                | ✅          |
| Auth code, public client, no PKCE          | ✅ refusal pinned | ✅ succeeds |
| Auth code, confidential, secret, PKCE      | ✅                | ✅          |
| Auth code, confidential, secret, no PKCE   | ✅                | ✅          |
| Auth code, confidential, `private_key_jwt` | ✅                | ✅          |
| `response_mode=form_post`                  | ✅                | n/a         |
| Streamlined mode                           | ✅                | ✅          |
| PAR, JAR, PAR + JAR                        | n/a               | ✅          |

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
