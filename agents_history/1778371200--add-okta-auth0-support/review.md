# Review: Okta/Auth0 Support

status: reviewed
updated: 2026-05-10

## High

Title: Non-Entra token exchange can be used as an arbitrary HTTPS request proxy

Why it matters: The confidential auth-code and client-credentials API routes are unauthenticated server-side fetchers that receive secrets or private keys and then POST to the resolved token endpoint. For non-Entra providers, the new guard only requires the caller-supplied token endpoint origin to equal the caller-supplied issuer origin. A direct request can therefore set `providerId` to `auth0` or `okta`, set `issuerUrl` to any HTTPS origin reachable from the deployment, and make the server POST there. This weakens the previous Entra-only allowlist into a same-origin check against untrusted input.

Evidence: [src/app/api/oauth/exchange-token/route.ts](src/app/api/oauth/exchange-token/route.ts#L34) and [src/app/api/oauth/client-credentials/route.ts](src/app/api/oauth/client-credentials/route.ts#L30) pass request-body `providerId`, `issuerUrl`, and `tokenEndpoint` into validation, then [exchange-token/route.ts](src/app/api/oauth/exchange-token/route.ts#L90) and [client-credentials/route.ts](src/app/api/oauth/client-credentials/route.ts#L84) fetch the returned URL. The non-Entra branch in [src/lib/tokenEndpoint.ts](src/lib/tokenEndpoint.ts#L56-L69) accepts any HTTPS URL whose origin matches the untrusted `issuerUrl` origin.

Suggested fix:

```ts
// src/lib/tokenEndpoint.ts
// ...existing code...
const providerId = normalizeProviderId(stringifyPrimitive(options.providerId));
const issuer = normalizeIssuerUrl(stringifyPrimitive(options.issuerUrl));

if (!isEntraProvider(providerId)) {
  if (!issuer || !isAllowedProviderIssuer(providerId, issuer)) return null;

  const discoveredTokenEndpoint = await resolveProviderTokenEndpointFromDiscovery(
    providerId,
    issuer,
  );

  return discoveredTokenEndpoint === url.toString() ? url.toString() : null;
}
// ...existing code...
```

At minimum, reject unknown/custom issuer hosts on the server for the Okta/Auth0 presets before any server-side fetch. Prefer deriving the token endpoint server-side from trusted discovery and comparing it exactly instead of trusting the client-provided endpoint.

## Medium

Title: Entra token validation can verify forged tokens against the token's own JWKS

Why it matters: The validation step resolves JWKS from the JWT `iss` claim before binding that issuer to the selected provider. For Entra, `issuerMatchesExpected` only checks whether the issuer string contains the tenant GUID. A token with `iss` like `https://attacker.example/<tenant-guid>`, a matching `aud`, and an attacker-hosted JWKS can show a valid signature and pass the Entra issuer check, which is a misleading validation result for users relying on this playground to understand token trust.

Evidence: [src/components/steps/StepValidate.tsx](src/components/steps/StepValidate.tsx#L168) resolves JWKS candidates from `payload.iss`, including arbitrary non-Microsoft discovery at [StepValidate.tsx](src/components/steps/StepValidate.tsx#L130-L134). The Entra issuer predicate in [src/lib/identityProvider.ts](src/lib/identityProvider.ts#L241-L250) uses substring matching, and the validation UI consumes that predicate at [StepValidate.tsx](src/components/steps/StepValidate.tsx#L310) and [StepValidate.tsx](src/components/steps/StepValidate.tsx#L339).

Suggested fix:

```ts
// src/lib/identityProvider.ts
// ...existing code...
if (isEntraProvider(providerId)) {
  if (!expectedIssuer) return issuer.trim().length > 0;
  try {
    const parsed = new URL(issuer);
    const host = parsed.hostname.toLowerCase();
    const tenant = parsed.pathname.split("/").filter(Boolean)[0];
    return (
      (host === "login.microsoftonline.com" || host === "sts.windows.net") &&
      tenant?.toLowerCase() === expectedIssuer.toLowerCase()
    );
  } catch {
    return false;
  }
}
// ...existing code...
```

Also consider refusing signature verification against non-Microsoft JWKS when `providerId === "entra"`, so signature and issuer checks are bound to the same trust context.

## Low

Title: Client credentials still defaults non-Entra API calls to Microsoft Graph

Why it matters: Okta/Auth0 provider switching clears the client-credentials API endpoint to the provider default, which is currently empty, but the page immediately falls back to Microsoft Graph. A user who reaches the Call API step with an Okta/Auth0 token sees Graph prefilled and can accidentally send that bearer token to the wrong resource. That is both a provider-neutral UX regression and unnecessary token disclosure to an unrelated API.

Evidence: [src/app/[locale]/(main)/client-credentials/page.tsx](src/app/[locale]/(main)/client-credentials/page.tsx#L113-L115) falls back to `https://graph.microsoft.com/v1.0/users` whenever the persisted endpoint is empty, while provider changes set the endpoint from provider defaults and those defaults are empty for Okta/Auth0.

Suggested fix:

```tsx
// src/app/[locale]/(main)/client-credentials/page.tsx
// ...existing code...
const apiEndpointUrl =
  clientCredentialsConfig.apiEndpointUrl ||
  getProviderDefaultApiEndpoint(providerId, "clientCredentials");
// ...existing code...
```

Keep the Graph fallback only for Entra, or leave the field blank for providers without a safe generic resource.