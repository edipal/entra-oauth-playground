# Auth0 support + e2e testability — state and open topics

status: T3, T4, T6, T7 and T8 complete, all uncommitted on top of `fcbdc04`
branch: `contributing` — 1 ahead of `origin/contributing`, plus an uncommitted working tree
work last touched: 2026-08-15 (T3 live layer, then T4, T6, T7, T8)
state verified: 2026-08-15
remaining: [T5](#t5--no-ci-and-no-playwright-install-step) (CI),
[T10](#t10--auth0-confidential-client-secret-is-rejected-on-the-original-tenant) (live
suite red), and pushing everything — see [T1](#t1--commit-the-work)

Living document. Update the **Progress log** at the bottom and flip the checkboxes
as topics close. Related history lives in
[agents_history/1778371200--add-okta-auth0-support/](agents_history/1778371200--add-okta-auth0-support/)
(`task.md`, `plan.md`, `implementation.md`, `review.md`).

---

## Where the work stopped

The last edits were [e2e/README.md](e2e/README.md) and
[implementation.md](agents_history/1778371200--add-okta-auth0-support/implementation.md)
on 2026-08-09 11:28, immediately after finishing the Auth0 live authorization-code
specs, factoring the shared wizard driver into
[e2e/support/authCode.ts](e2e/support/authCode.ts), and adding the `warmup`
Playwright project. The Auth0 feature work itself (provider workspaces, PAR/JAR/RAR,
provider-scoped settings, provider-aware claims and validation) landed on 2026-08-04;
everything after that date was test infrastructure.

All of it — 157 files, 20,798 insertions — went into a single commit on 2026-08-15,
`fcbdc04 auth0 support + e2e tests`. The working tree is clean; the commit has not
been pushed.

## Verified green (2026-09-06)

Re-measured against the working tree after the review fixes. The previous table was
taken on 2026-08-15 and had gone stale in every row that counts something.

| Check        | Command            | Result                                                       |
| ------------ | ------------------ | ------------------------------------------------------------ |
| Unit tests   | `pnpm test`        | 146 tests, 12 files, pass                                    |
| Lint         | `pnpm lint`        | clean                                                        |
| Build        | `pnpm build`       | exit 0, 20 routes plus middleware emitted                    |
| Offline e2e  | `pnpm e2e:offline` | 107/107 pass, ~35s                                           |
| Live e2e     | `pnpm e2e:live`    | 21 pass, 0 fail — last measured 2026-08-17, not re-run since |
| i18n parity  | en/de key diff     | 519 keys each, no gaps either direction                      |
| Okta removal | grep               | only surviving mentions are tests asserting rejection        |

Playwright browsers were **not** installed on this machine; the offline run needed
`npx playwright install chromium` first. See [T5](#t5--no-ci-and-no-playwright-install-step).

### Review findings from `review.md` — all closed

| Severity | Finding                                                                  | Where it is fixed                                                                                                                           |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | Non-Entra token exchange usable as an HTTPS request proxy                | [src/lib/tokenEndpoint.ts](src/lib/tokenEndpoint.ts) derives the expected endpoint from the trusted issuer and requires an exact match      |
| Medium   | Entra validation could verify forged tokens against the token's own JWKS | [src/lib/identityProvider.ts:294-309](src/lib/identityProvider.ts#L294-L309) binds the issuer to an allowed host **and** the tenant segment |
| Low      | Client credentials defaulted non-Entra API calls to Microsoft Graph      | Graph defaults now live only under the Entra provider entry in [identityProvider.ts:42-46](src/lib/identityProvider.ts#L42-L46)             |

---

## Open topics

| ID                                                                               | Topic                                                            | Priority | Status                               |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------- | ------------------------------------ |
| [T1](#t1--commit-the-work)                                                       | Commit the work                                                  | blocker  | ◐ committed, not pushed              |
| [T2](#t2--auth0-private_key_jwt-is-blocked-by-ui-validation)                     | Auth0 `private_key_jwt` blocked by UI validation                 | high     | ☑ **done**, both live specs verified |
| [T3](#t3--par-and-jar-have-no-test-coverage)                                     | PAR and JAR have no test coverage                                | high     | ☑ **done**, offline **and** live     |
| [T4](#t4--e2ereadmemd-overstates-the-offline-suite)                              | `e2e/README.md` overstates the offline suite                     | medium   | ☑ **done**, both specs written       |
| [T5](#t5--no-ci-and-no-playwright-install-step)                                  | No CI, and no `playwright install` step                          | medium   | ☐ open                               |
| [T6](#t6--pnpmoverrides-is-silently-ignored-by-pnpm-11)                          | `pnpm.overrides` silently ignored by pnpm 11                     | medium   | ☑ **done**, pins enforced again      |
| [T7](#t7--readme-drift)                                                          | README drift                                                     | low      | ☑ **done**                           |
| [T8](#t8--screenshots-0510-still-single-provider)                                | Screenshots 05–10 still single-provider                          | low      | ☑ **done**, and now repeatable       |
| [T9](#t9--decide-whether-agents-and-agents_history-belong-in-the-repo)           | Decide on `.agents/` and `agents_history/`                       | low      | ☑ done — both committed              |
| [T10](#t10--auth0-confidential-client-secret-is-rejected-on-the-original-tenant) | Auth0 confidential client secret rejected on the original tenant | medium   | ☐ open                               |

---

### T1 — Commit the work

**Priority:** blocker · **Status:** ◐ committed 2026-08-15, not pushed

Two months of unversioned work is now in git: `fcbdc04 auth0 support + e2e tests`,
157 files, 20,798 insertions against 3,726 deletions. It went in as one commit rather
than the reviewable slices this topic asked for, which is a reviewability cost rather
than a correctness one — worth knowing before opening a PR, since a 157-file diff with
a three-word message is hard for anyone else to read.

Checked on the commit itself: `.env.e2e.local` is **not** tracked, no `.DS_Store`
slipped in, and `.agents/` plus `agents_history/` were included — which settles
[T9](#t9--decide-whether-agents-and-agents_history-belong-in-the-repo) by decision.

- [x] decide `.agents/` / `agents_history/` — both committed
- [x] commit the work (as one commit, not slices)
- [ ] push to `origin/contributing`
- [ ] consider a PR description carrying what the three-word message cannot

---

### T2 — Auth0 `private_key_jwt` is blocked by UI validation

**Priority:** high · **Status:** ☑ **done** 2026-08-15 — code complete; unit, offline and
both live specs verified against real tenants.

The client-authentication step gated its Next button on a private key **plus a
certificate plus a SHA-1 thumbprint**, which is how Entra identifies an assertion
key (`x5t`). Auth0 identifies the key by a `kid` it generates for the registered
public key and has no certificate in the picture, so the step could not be
completed for Auth0 at all.

The assertion `aud` was also made provider-aware, to match what Auth0 documents:
the tenant URL with a trailing slash rather than the token endpoint. **Measured
against a live tenant afterwards, this was a correctness/portability improvement
rather than a bug fix** — Auth0 accepts the trailing-slash tenant URL _and_ the
token endpoint, and rejects only the issuer without its trailing slash. The PAR
route was aligned the same way.

What changed:

- `getClientAssertionAudience` in [src/lib/identityProvider.ts](src/lib/identityProvider.ts)
  is the single place that decides the assertion `aud` — tenant URL + `/` for Auth0
  (only for an allowlisted issuer), token endpoint for Entra.
- [src/lib/jwtSign.ts](src/lib/jwtSign.ts) takes `audience` rather than
  `tokenEndpoint`; the old name is what made the bug easy to miss.
- [src/lib/oauthTokenHandlers.ts](src/lib/oauthTokenHandlers.ts) and
  [/api/oauth/auth0/par](src/app/api/oauth/auth0/par/route.ts) use it, and never
  forward an `x5t` for Auth0 — a hand-edited localStorage cannot inject a stale
  Entra thumbprint.
- The credential UI is split per provider:
  [steps/entra/CertificateCredential.tsx](src/components/steps/entra/CertificateCredential.tsx)
  (unchanged Entra wizard) and
  [steps/auth0/PrivateKeyCredential.tsx](src/components/steps/auth0/PrivateKeyCredential.tsx)
  (public key to register, `kid` read back from the Management API).
  `StepAuthentication` is now the provider-neutral shell.
- Both flows validate per provider: Entra needs certificate + thumbprint, Auth0
  needs a `kid`.

- [x] provider-aware validator in `ClientCredentialsFlow`
- [x] provider-aware validator in `AuthorizationCodeConfidentialClientFlow`
- [x] Auth0 credential section with no certificate or thumbprint
- [x] provider-aware assertion `aud`, plus the same fix in the PAR route
- [x] unit tests: [tests/jwtSign.test.ts](tests/jwtSign.test.ts), `getClientAssertionAudience` cases in [tests/identityProvider.test.ts](tests/identityProvider.test.ts)
- [x] offline spec: [e2e/client-auth.offline.spec.ts](e2e/client-auth.offline.spec.ts) pins both providers' gating
- [x] live spec: Auth0 client credentials, `private_key_jwt`
- [x] live spec: Auth0 confidential auth code, `private_key_jwt`
- [x] coverage table in [e2e/README.md](e2e/README.md)
- [x] Auth0 applications provisioned and both live specs run against real tenants

**Live setup (2026-08-15).** Private Key JWT is exclusive per application — switching
an application to it hides the client secret the other specs authenticate with — so
the two applications live on their own Auth0 tenant (`E2E_AUTH0_PKJWT_ISSUER_URL`).
Every `E2E_AUTH0_PKJWT_*` variable falls back to its single-tenant equivalent,
`e2e/support/credentials.ts` exposes them as `auth0PkJwt`, and
`authorizeThroughPopup` takes the sign-in user as a parameter so a round trip never
straddles two tenants.

**Both live specs verified.** Client credentials: the UI reaches Tokens with a private
key and a `kid` alone, and Auth0 issues a `gty=client-credentials` token. Confidential
authorization code: real sign-in, then the code redeemed server-side through
`/api/oauth/auth0/exchange-token` with the signed assertion, decoded, validated, and
spent on `/userinfo`. Both Entra `private_key_jwt` specs still pass, so the
shared-library refactor caused no regression.

**Both pass in the same run**, on one tenant — measured 2026-08-17, 21 of 21 live
specs green. Register the *same* public key on both applications: Auth0 derives the
`kid` from the RFC 7638 JWK thumbprint, so one key yields one `kid` that covers both,
and one `E2E_AUTH0_CREDENTIAL_KID` serves them. `pnpm provision:auth0` does this.

(This section previously recorded the opposite — that the tenant allowed only a
single Private Key JWT credential, so one of the two specs was always red. That is no
longer the case, and a `private_key_jwt` failure should now be read as a real
regression rather than an expected one.)

**Tenant setup that is easy to miss**, beyond the assignment trap below: the tenant
needs its own API, its own database connection enabled on the application, and its own
test user — and the API's _Machine To Machine Applications_ list must include the
**Regular Web Application** and the **SPA**, not just the M2M one. Without that
authorization Auth0 refuses the authorization request with `Client ... is not
authorized to access resource server ...` before any login form appears, even though
the flow is user-delegated.

The grant carries a `subject_type` that the dashboard does not surface: `user` for
the authorization code flow, `client` for client credentials, and both for an
application that serves both. Setup instructions live in
[e2e/README.md](e2e/README.md) under _Authorizing an application against the API_;
[provision-auth0.mts](scripts/provision-auth0.mts) creates them per application.

**Three false trails, recorded so they are not walked again.**

1. _"Private Key JWT needs an Enterprise plan."_ Auth0's docs say so, but both tenants
   in use advertise it in `token_endpoint_auth_methods_supported`. Not the gate.
2. _`401 invalid_client` that survived every `aud`, `kid`, `alg` and header variation._
   The probes were hitting the **wrong tenant** — the client ids lived on the new
   tenant while `E2E_AUTH0_ISSUER_URL` still named the old one. A client id absent
   from the tenant you ask yields exactly that error, whatever else is correct.
3. _"The assertion `aud` was wrong."_ Measured afterwards: Auth0 accepts the
   trailing-slash tenant URL **and** the token endpoint, rejecting only the issuer
   without its slash. The change is right by documentation and portability, but it
   fixed nothing that was broken.

**The actual trap:** adding a credential does **not** assign it to the application's
authentication method. An application left on Client Secret rejects every assertion
with `invalid_client`. Proven by contrast — same key, same `kid`, same tenant, one
application assigned and one not. This is now the loudest warning in
[e2e/README.md](e2e/README.md)'s provisioning note.

---

### T3 — PAR and JAR have no test coverage

**Priority:** high · **Status:** ☑ **done** 2026-08-15 — covered offline **and** live,
all four request modes

Two defects surfaced while covering this, so it became a fix as well as a test topic.

**JAR could not be driven forward through the UI.** The signing key lived in the
Authentication step (index 5), _after_ Authorize (index 3), so selecting JAR and
launching always failed with `requestObjectMissingPrivateKey` unless the user
navigated backwards. The request object is now signed where it is sent: the Auth0
authorization-request section grows `auth0RequestObjectKey` and
`auth0RequestObjectKid` fields, shown only for the JAR and PAR + JAR modes. The key
binds to the existing **runtime** `privateKeyPem`, so it is never persisted and also
satisfies the later client-auth step when the method is `certificate`.

**The public client offered PAR that could not work.** Auth0 supports PAR for
confidential clients only, and the public flow pushed with no client authentication
at all. The mode is gone from that flow, along with a dead `par-jar` branch that
would have behaved as plain PAR. `Auth0AuthorizationRequestOptions` now takes
`supportedModes` instead of an `includeJarModes` boolean, renders no selector when
only one mode is available, and resets any unusable persisted mode to `url`.

The persisted `jarKid` setting is gone: it had no UI and was read by nothing — the
request object signs with `clientAssertionKid`.

- [x] `tests/requestObject.test.ts` — header `typ`/`alg`/`kid`, `iss`/`aud`, 60s
      lifetime, unique `jti`, claims and `authorization_details` passthrough
- [x] `e2e/auth-request-routes.offline.spec.ts` — both Auth0 routes over HTTP: issuer
      allowlist, missing parameters, `invalid_authorization_details`,
      `missing_client_secret`, and a valid request object that decodes
- [x] `e2e/auth-request-modes.offline.spec.ts` — mode selector per client type; PAR
      launching with only `client_id` + `request_uri`; JAR with `request`; PAR + JAR
      pushing the object rather than the parameters; JAR without a key stopping with
      an error; a failed push **not** falling back to a plain URL; RAR reaching the
      pushed body compacted; a stale public-client `par` normalising to `url`
- [x] JAR signing key available at the Authorize step
- [x] PAR removed from the public client
- [x] `e2e/README.md` records the discovery check and the full PAR/JAR provisioning
- [x] live specs: PAR, JAR and PAR + JAR round trips on the private_key_jwt tenant
- [x] request-object `aud` fixed and pinned by unit, offline and live tests

**Live PAR, JAR and PAR + JAR now pass** against the trial tenant, added after the
offline pass once the tenant was configured. Getting there needed three things, all
recorded in [e2e/README.md](e2e/README.md): tenant-level _Allow PAR_, **the
private_key_jwt credential also assigned to `signed_request_object`**, and both
per-application _Require_ toggles left **off**. One credential covers both roles —
[provision-auth0.mts](scripts/provision-auth0.mts) PATCHes the same credential id
into `client_authentication_methods` and `signed_request_object` in one request, and
an application has only two credential slots to spend. (An earlier note here said
the private_key_jwt credential "does not serve double duty" and a second key was
needed. What Auth0 actually requires is the assignment: unassigned, it answers
`Client has no associated credentials for signed JWT` however many credentials the
application holds.) _Require PAR_ in
particular makes every non-PAR request fail with `The usage of Pushed Authorization
Requests is required by the configuration`, which silently took down the
`private_key_jwt, with PKCE` spec while it was on.

**That work found a real defect.** Auth0 accepts a request object whose `aud` is the
tenant URL with a trailing slash and rejects the identical object without it, with a
bare 400 and no error code. [requestObject.ts](src/lib/requestObject.ts) signed for
the normalized issuer, which has the slash stripped — so **JAR was broken as
shipped**. The same defect class as the client-assertion audience in T2, but this one
had teeth: there is no second accepted form. Both audiences now come from one
`getAuth0TenantAudience` in [identityProvider.ts](src/lib/identityProvider.ts) so they
cannot drift again.

The offline pass also left a gap of its own: the signing-key fields were shown for
JAR modes only, missing plain **PAR with `private_key_jwt`**, where the push is itself
authenticated and needs the key at Authorize. On a tenant whose application has no
client secret that is the normal case, not an edge one.

**A note for whoever writes the next offline spec:** stub only the provider paths you
mean to intercept. Routing the whole issuer origin also swallows
`/.well-known/openid-configuration`, and without it the Auth0 workspace cannot resolve
its endpoints or leave the Settings step — which presents as seven unrelated
"Next is disabled" failures.

---

### T4 — `e2e/README.md` overstates the offline suite

**Priority:** medium · **Status:** ☑ **done** 2026-08-15 — 10 new offline specs

[e2e/README.md](e2e/README.md) claimed the offline project covered "per-workspace
settings isolation" and "decode/validate against fixture tokens". Neither existed.
The README half was corrected during T3; the missing coverage is now written.

**[e2e/settings-isolation.offline.spec.ts](e2e/settings-isolation.offline.spec.ts)** —
five specs on the workspace split, driven through the sidebar selector a user
actually uses: neither workspace can see the other's issuer, tenant, client id,
audience or scopes; each is restored from its own localStorage key on a full
navigation; a hand-edited workspace claiming `providerId: "entra"` under the Auth0 key
still renders and re-persists as Auth0 (the route decides, not storage); flows inside
one workspace keep separate settings; and each provider's per-flow defaults are what
appear before anything is configured.

**[e2e/token-decode.offline.spec.ts](e2e/token-decode.offline.spec.ts)** — five specs
that run a **whole authorization-code round trip with no identity provider**, on top
of a new [e2e/support/stubProvider.ts](e2e/support/stubProvider.ts): discovery,
`/authorize` redirecting straight back to the app's own callback with a code, the
token endpoint, and a JWKS. The popup, the callback page, the `postMessage` to the
opener, the exchange and the signature verification are all the app's real code, so
the tokens are the only thing stubbed — and therefore ours to shape:

- a clean round trip: both tokens decode, both signatures verify against the JWKS the
  discovery document advertises, and the exchange carried the callback's code plus a
  PKCE verifier in RFC 7636's alphabet
- a **compact JWE** access token: the protected header reads, the payload does not,
  and Validate reports _Skipped_ rather than a failure — the Auth0 path a live tenant
  will not produce on request
- a token signed by a key the JWKS never published: _Not verified_, with the reason
- a `nonce` from another request: flagged on its own line while `aud`, `iss`, `exp`
  and the signature all stay green
- an expired token: the `exp` line fails **and so does the signature line**, because
  the verifier will not vouch for a stale token even when the key matches

- [x] offline spec: per-workspace settings isolation
- [x] offline spec: decode + validate against fixture tokens (incl. a compact JWE)
- [x] reconcile the README wording either way

**Two things worth knowing before extending this.** Stub the exact provider paths,
never the whole origin — a wildcard on the issuer swallows
`/.well-known/openid-configuration` too, and the workspace then cannot leave Settings.
And Auth0 answers discovery for _any_ subdomain, so the earlier offline specs that do
not stub it have been reaching the real internet for `demo-tenant.eu.auth0.com`; the
new ones do not.

---

### T5 — No CI, and no `playwright install` step

**Priority:** medium · **Status:** ☐ open

[.github/workflows/](.github/workflows/) has `docker-publish.yml`, `release.yml` and
`ossf-scorcard.yml` — nothing runs `pnpm test` or `pnpm e2e:offline`. Both are fast
(under a second, and ~16s) and need no credentials, which makes them an ideal PR
gate. The live project must never run in CI: it needs real tenant credentials.

Separately, the offline suite is not runnable from a clean machine without
`npx playwright install`. This was hit on 2026-08-15: the browser cache was empty
and warmup failed with `Executable doesn't exist`. [e2e/README.md](e2e/README.md)
currently says offline "needs no setup", and
[CONTRIBUTING.md:61](CONTRIBUTING.md#L61) asks only for "lint/build checks".

**Done when:** a PR workflow runs lint, build, unit tests and offline e2e; and the
browser install step is documented.

- [ ] `.github/workflows/ci.yml` — lint + build + `pnpm test` + `pnpm e2e:offline`
- [ ] `npx playwright install chromium` in the workflow and in the docs
- [ ] extend the CONTRIBUTING.md PR checklist to name the test commands
- [ ] fix the "needs no setup" line in `e2e/README.md`

---

### T6 — `pnpm.overrides` is silently ignored by pnpm 11

**Priority:** medium · **Status:** ☑ **done** 2026-08-15

pnpm 11.21 printed `The "pnpm" field in package.json is no longer read by pnpm. The
following keys were ignored: "pnpm.overrides"` on every invocation. The security pins
— `ajv@<6.14.0` and three `minimatch` ranges — were therefore not being applied.

**Measured before fixing, because "ignored" needed proving.** Running
`pnpm install --lockfile-only` on the old configuration **deleted the `overrides:`
block from `pnpm-lock.yaml` outright**. The resolved versions did not move, but only
because pnpm keeps a resolution that still satisfies its specifier — the pins had
stopped being enforced, and the next dependency bump would have been free to fall
below them.

The four entries now live in [pnpm-workspace.yaml](pnpm-workspace.yaml), which is
where pnpm 10+ reads settings from even for a single-package repo. After the move
`pnpm-lock.yaml` is **byte-identical to the committed one** — the same resolution set,
now enforced rather than inherited.

Installed and confirmed against the pins: `ajv@6.14.0`, `minimatch@3.1.4`,
`minimatch@9.0.7`. No `minimatch@10.x` is in the tree, so that entry is a floor
waiting for one.

- [x] move overrides to `pnpm-workspace.yaml`
- [x] `pnpm install` and verify no warning
- [x] confirm resolved `ajv` / `minimatch` versions satisfy the pins
- [x] re-verify the toolchain after the reinstall — lint, build, 114 unit, 60 offline e2e

**Two things that surprised the install, neither caused by the move.**

1. _pnpm insisted on purging `node_modules`._ `node_modules/.modules.yaml` recorded
   `packageManager: pnpm@10.20.0`, and pnpm rebuilds the modules directory across a
   major version. This was due on the next install regardless.
2. _pnpm asked which install scripts to allow_, writing an `allowBuilds:` block with
   `set this to true or false` placeholders. `@parcel/watcher`, `@swc/core`, `sharp`
   and `unrs-resolver` are all set to **false**, which preserves exactly what this
   repo has always done — package.json never listed `onlyBuiltDependencies`, so pnpm
   10 blocked them too. All four ship prebuilt binaries as optional dependencies;
   lint, build, unit and e2e all pass without them. Flip one to `true` only if its
   prebuild turns out to be missing on some platform.

---

### T7 — README drift

**Priority:** low · **Status:** ☑ **done** 2026-08-15

The workspace selector moved into the sidebar under the logo, with the topbar copy
shown only for slim, slim-plus and horizontal layouts and below 992px. README
described it as top-right in three places; all three now say sidebar, and the
Overview explains **why** it sits there — switching workspace rewrites the menu
beneath it — plus when it falls back to the top bar.

README had no testing section either. It now lists `pnpm lint`, `pnpm test`,
`pnpm e2e:offline`, `pnpm e2e:live` and `pnpm e2e`, names the
`npx playwright install chromium` prerequisite that a clean machine needs, says that
the offline project contacts no provider and that live specs skip themselves when
credentials are absent, then hands off to [e2e/README.md](e2e/README.md).

**Two more pieces of drift found while reading, both from T3.** The Usage section
listed PAR and JAR as options for "Auth0 authorization-code flows" without saying
they are confidential-client only, and the caption on `04-authorize-auth0.png`
advertised "a request mode (URL or PAR)" on a **public client** screenshot. Both are
corrected, and the screenshot itself is now stale — it still shows the dropdown — so
it moved into [T8](#t8--screenshots-0510-still-single-provider) with a note in the
README until it is recaptured.

- [x] correct the three selector-location references
- [x] add a short testing section pointing at [e2e/README.md](e2e/README.md)
- [x] correct the Usage entry on PAR/JAR client types
- [x] correct the Auth0 Authorize caption, and flag the stale dropdown in the shot

---

### T8 — Screenshots 05–10 still single-provider

**Priority:** low · **Status:** ☑ **done** 2026-08-15

`05-callback` through `10-call-api` showed the earlier single-provider UI, and
`04-authorize-auth0.png` still carried a **Request mode** dropdown on a public client
that [T3](#t3--par-and-jar-have-no-test-coverage) removed. All are recaptured, plus a
new `04-authorize-auth0-confidential.png` for the modes themselves.

**The premise that this needed a real tenant is no longer true**, and that is what
unblocked it. [T4](#t4--e2ereadmemd-overstates-the-offline-suite)'s
[stubProvider](e2e/support/stubProvider.ts) already drives a complete
authorization-code round trip with no identity provider; extending it to Entra took
one function, since Entra derives its endpoints from a template and needs no discovery
stub at all. The capture is now a Playwright project:

```bash
pnpm screenshots
```

[e2e/screenshots.capture.ts](e2e/screenshots.capture.ts) seeds demo settings, stubs
`/authorize`, the app's own exchange route, the JWKS and the protected API, then walks
Callback → Authentication → Tokens → Decode → Validate → Call API taking a shot at
each. It skips itself unless `E2E_CAPTURE` is set, so `pnpm e2e` never rewrites the
images.

**This also removed real identifiers from the repository.** The old shots carried a
live tenant GUID, client id and a full access token in `05`, `09` and `10`. Everything
in the new set is a placeholder, and the tokens are minted by the capture itself
against a key that exists for the length of the run.

Two things had to be worked out, both recorded in the file:

1. _`fullPage: true` is wrong here._ The sidebar is `position: fixed` and `100vh`, so
   a full-page capture paints it once at viewport height and leaves it floating over
   the middle of a longer page. The fix is to grow the window to the content height
   and capture the viewport instead — which is evidently how the original shots were
   taken, since they are all viewport-shaped.
2. _An open dropdown panel cannot be captured this way either_ — it is positioned
   against the viewport and lands in the wrong place. The confidential shot therefore
   selects **PAR + JAR** rather than opening the list: it shows the selector, the
   explanation of the mode, and the signing-key fields the request object needs.

- [x] recapture `04-authorize-auth0.png` — public client, no request-mode selector
- [x] add an Auth0 confidential Authorize shot for the request modes
- [x] recapture 05–10 at 1440px with demo identifiers
- [x] drop the warning note and the request-mode note from README
- [x] make it repeatable — `pnpm screenshots`, documented in both READMEs

**Noticed while capturing, not fixed:** in PAR and PAR + JAR modes the Authorize step
still renders "The full authorization URL that will open in the popup" with a plain
URL, even though the request is pushed and the popup is sent to a `request_uri`. It is
a preview of something the app will not send. Small, cosmetic, and out of scope here.

---

### T9 — Decide whether `.agents/` and `agents_history/` belong in the repo

**Priority:** low · **Status:** ☑ done 2026-08-15 — both committed in `fcbdc04`

Both are untracked. This is a public repository, so the choice is commit them as
process documentation, or add them to `.gitignore`. The same question applies to
this file. `.env.e2e.local` is already correctly ignored and must stay that way —
it holds real tenant credentials.

- [ ] decide: commit or ignore
- [ ] apply, and confirm `git check-ignore` on `.env.e2e.local` still passes

---

### T10 — Auth0 confidential client secret is rejected on the original tenant

**Priority:** medium · **Status:** ☐ open · **Found:** 2026-08-15

The two `Auth0 authorization code (confidential client) - client secret` specs fail
with `access_denied / Unauthorized` from the token endpoint. They passed on
2026-08-09; 2026-08-15 is the first run since, so the breakage is undated.

**Not a code regression** — reproduced with `curl` against the original tenant, no
app involved, and the response is byte-identical for the stored secret and a
deliberately wrong one:

```
confidential app + stored secret -> 401 access_denied / Unauthorized
confidential app + wrong secret  -> 401 access_denied / Unauthorized
```

Identical answers for a right and a wrong secret mean that application is not
authenticating by secret at all. Two candidates: the secret in `.env.e2e.local` is
stale, or that Regular Web Application was switched to Private Key JWT.

- [ ] check the app's _Credentials → Authentication Methods_ on the original tenant
- [ ] if it is on Private Key JWT, switch it back to Client Secret
- [ ] otherwise copy the current secret into `E2E_AUTH0_CLIENT_SECRET`
- [ ] re-run `pnpm e2e:live` and confirm both specs return

---

## Live coverage today

Unchanged from [e2e/README.md](e2e/README.md); repeated here so the blocked cells
are visible next to [T2](#t2--auth0-private_key_jwt-is-blocked-by-ui-validation).

| Flow                                       | Entra                       | Auth0             |
| ------------------------------------------ | --------------------------- | ----------------- |
| Client credentials, client secret          | ✅                          | ✅                |
| Client credentials, `private_key_jwt`      | ✅                          | ✅ live-verified  |
| Auth code, public client, PKCE             | ✅                          | ✅                |
| Auth code, public client, no PKCE          | ✅ refusal pinned           | ✅ succeeds       |
| Auth code, confidential, secret, PKCE      | ✅                          | ✅                |
| Auth code, confidential, secret, no PKCE   | ✅                          | ✅                |
| Auth code, confidential, `private_key_jwt` | ✅                          | ✅ live-verified  |
| `response_mode=form_post`                  | ✅                          | n/a               |
| Streamlined mode                           | ✅                          | ✅                |
| PAR / JAR / PAR+JAR                        | n/a (no Entra PAR endpoint) | ✅ live-verified  |

`private_key_jwt` is **not** plan-gated — both tenants advertise it in
`token_endpoint_auth_methods_supported`. It needs its own applications, and in
practice its own tenant, for the reasons in [T2](#t2--auth0-private_key_jwt-is-blocked-by-ui-validation).
PAR and JAR do need the Highly Regulated Identity add-on, and the trial tenant has it:
once _Allow PAR_ was switched on and a request-object credential registered, all three
modes passed live.

Entra PAR was implemented and reverted: Microsoft Entra ID exposes no pushed
authorization request endpoint (`/{tenant}/oauth2/v2.0/par` returns a bare 404 and
discovery advertises no `pushed_authorization_request_endpoint`). Revisit if
Microsoft ships RFC 9126 support.

---

## Progress log

- **2026-08-04** — Auth0 feature work complete: provider workspaces, provider-scoped
  settings, four provider API routes, RAR/PAR/JAR, provider-aware claims and
  validation, translations, README, screenshots 00–04 and 11–12.
- **2026-08-08** — Vitest added; certificate thumbprint derivation fixed for pasted
  certificates; Playwright scaffolding, offline suite, live client-credentials specs.
- **2026-08-09** — Entra live auth-code matrix, Auth0 live auth-code matrix, shared
  `authCode` driver, `warmup` project. Last work before the pause.
- **2026-08-15** — State audit. Lint, build, 97 unit tests and 30 offline e2e tests
  all green; all three `review.md` findings confirmed fixed in code. Open topics
  T1–T9 recorded above.
- **2026-08-15** — T2 done. Auth0 `private_key_jwt` is reachable and live-verified:
  per-provider credential UI (`steps/entra/`, `steps/auth0/`), per-provider step
  validators, a provider-aware assertion `aud`, and no `x5t` for Auth0. 107 unit
  tests, 32 offline e2e, lint and build clean; Auth0 client credentials with
  `private_key_jwt` passes against a real tenant, as do both Entra `private_key_jwt`
  specs. The confidential auth-code spec passes too: real sign-in, server-side code
  exchange with the signed assertion, decode, validate, `/userinfo`. Provisioning cost
  most of the session — see T2's false trails and T10, opened along the way.
- **2026-08-15** — Everything committed as `fcbdc04 auth0 support + e2e tests`: 157
  files, one commit rather than the planned slices. Working tree clean, not yet
  pushed. `.env.e2e.local` stayed untracked and no `.DS_Store` went in; `.agents/`
  and `agents_history/` were included, closing T9 by decision.
- **2026-08-15** — T3 done. PAR/JAR are covered offline by 20 new specs across two
  files plus `tests/requestObject.test.ts`, and two defects found on the way are
  fixed: JAR now takes its signing key at the Authorize step instead of a later one,
  and the public client no longer offers a PAR mode Auth0 cannot serve. Dead `jarKid`
  setting removed. 112 unit tests, 50 offline e2e, lint and build clean; the live
  suite shows only the three known failures. Live PAR/JAR confirmed unreachable by
  discovery on both tenants.
- **2026-08-15** — T3 live layer. PAR, JAR and PAR + JAR now pass against the trial
  tenant. Configuring it exposed a shipped bug: request objects were signed for the
  bare issuer, which Auth0 rejects — the `aud` needs the tenant's trailing slash, and
  both Auth0 audiences now come from one helper. Also closed a gap the offline pass
  left, where plain PAR with `private_key_jwt` never offered the signing key it needs.
  114 unit tests, 50 offline e2e, 18 live pass with only the three known failures.
- **2026-08-15** — T4 done. The two specs `e2e/README.md` had been claiming now exist:
  workspace settings isolation (5) and token decode/validate against fixture tokens
  (5), the latter on a new `stubProvider` support module that runs a complete
  authorization-code round trip with the provider stubbed and everything else real.
  That reaches four cases live tenants cannot be asked for — a compact JWE, an
  unpublished signing key, a foreign `nonce` and an expired token. 60/60 offline,
  114 unit, lint, typecheck and build clean.
- **2026-08-15** — T6 done. The four security overrides moved from package.json's
  `pnpm` field, which pnpm 11 ignores, to `pnpm-workspace.yaml`. Proven ignored
  first: a resolve on the old configuration stripped the `overrides:` block out of
  the lockfile. After the move the lockfile is byte-identical to the committed one,
  and `ajv@6.14.0` / `minimatch@3.1.4` / `minimatch@9.0.7` are installed against the
  pins. The install rebuilt `node_modules` (a pnpm 10 → 11 major upgrade, not the
  move) and asked which install scripts to allow; all four are declined, matching
  what the repo already did. Lint, build, unit and offline e2e re-verified after.
- **2026-08-15** — T7 done. README's three "top-right selector" references now say
  sidebar, and the Overview says why it lives there and when it falls back to the top
  bar. A testing section was added — the five commands, the `playwright install`
  prerequisite, what offline and live each need — pointing at `e2e/README.md`.
  Reading it turned up two further drifts from T3: PAR/JAR were described as
  available to Auth0 authorization-code flows generally rather than to confidential
  clients only, and `04-authorize-auth0.png` captions a request-mode dropdown on a
  public-client shot. Text fixed; the screenshot moved to T8 with a note under the
  image in the meantime.
- **2026-08-15** — T8 done, and no longer a manual chore: `pnpm screenshots` drives
  the same stubbed provider the offline suite uses, so the steps that used to need a
  real sign-in now capture themselves. `04-authorize-auth0.png` is corrected, a
  confidential shot was added for the request modes, and 05–10 are regenerated at
  1440px against the current UI. Side benefit: the old set carried a real tenant GUID,
  client id and access token into a public repository, and the new one carries only
  placeholders and tokens minted during the run.
