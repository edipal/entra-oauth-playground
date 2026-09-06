import type { ClientAuthMethod } from "@/types/client-auth";

/**
 * Why a token exchange cannot be sent yet.
 *
 * Each flow used to open `handleExchangeTokens` with a run of bare `return`
 * guards while the Send button stayed enabled, so clicking it produced nothing at
 * all — no spinner, no error, no response. A missing client secret is the easiest
 * of these to arrive at, and the least guessable from an unchanged screen.
 *
 * The codes are resolved to text by StepTokens, so the wording lives with the
 * component that renders it.
 */
export type TokenExchangeBlocker =
  | "providerConfig"
  | "clientId"
  | "redirectUri"
  | "tokenEndpoint"
  | "authCode"
  | "codeVerifier"
  | "clientSecret"
  | "privateKey"
  | "grantParameters";

type Readiness = {
  providerConfigValid: boolean;
  clientId: string;
  tokenEndpoint: string;
  /** Authorization-code flows only; omitted by client credentials. */
  redirectUri?: string;
  authCode?: string;
  pkceEnabled?: boolean;
  codeVerifier?: string;
  /** Client credentials only: Auth0 needs an audience, Entra needs scopes. */
  grantParametersValid?: boolean;
  /** Public clients authenticate with nothing, and pass no method. */
  clientAuthMethod?: ClientAuthMethod;
  clientSecret?: string;
  privateKeyPem?: string;
};

/**
 * The first unmet precondition, or null when the exchange can be sent.
 *
 * Ordered the way the wizard fills them in, so the reason named is the earliest
 * thing the user still has to do rather than an arbitrary one of several.
 */
export function findTokenExchangeBlocker(
  input: Readiness,
): TokenExchangeBlocker | null {
  if (!input.providerConfigValid) return "providerConfig";
  if (!input.clientId) return "clientId";
  if (input.redirectUri !== undefined && !input.redirectUri) {
    return "redirectUri";
  }
  if (!input.tokenEndpoint) return "tokenEndpoint";
  if (input.grantParametersValid === false) return "grantParameters";
  if (input.authCode !== undefined && !input.authCode) return "authCode";
  if (input.pkceEnabled && !input.codeVerifier) return "codeVerifier";
  if (input.clientAuthMethod === "secret" && !input.clientSecret) {
    return "clientSecret";
  }
  if (input.clientAuthMethod === "certificate" && !input.privateKeyPem) {
    return "privateKey";
  }
  return null;
}
