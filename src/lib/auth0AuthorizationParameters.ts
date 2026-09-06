export type Auth0AuthorizationParameters = {
  connection: string;
  connectionScope: string;
  organization: string;
  invitation: string;
  screenHint: string;
  maxAge: string;
  uiLocales: string;
  acrValues: string;
  claimsLocales: string;
  idTokenHint: string;
};

export const DEFAULT_AUTH0_AUTHORIZATION_PARAMETERS: Auth0AuthorizationParameters =
  {
    connection: "",
    connectionScope: "",
    organization: "",
    invitation: "",
    screenHint: "",
    maxAge: "",
    uiLocales: "",
    acrValues: "",
    claimsLocales: "",
    idTokenHint: "",
  };

const setIfPresent = (
  searchParams: URLSearchParams,
  name: string,
  value: string,
) => {
  const trimmed = value.trim();
  if (trimmed) {
    searchParams.set(name, trimmed);
  }
};

export function appendAuth0AuthorizationParameters(
  searchParams: URLSearchParams,
  parameters: Auth0AuthorizationParameters,
) {
  setIfPresent(searchParams, "connection", parameters.connection);
  setIfPresent(searchParams, "connection_scope", parameters.connectionScope);
  setIfPresent(searchParams, "organization", parameters.organization);
  setIfPresent(searchParams, "invitation", parameters.invitation);
  setIfPresent(searchParams, "screen_hint", parameters.screenHint);
  setIfPresent(searchParams, "max_age", parameters.maxAge);
  setIfPresent(searchParams, "ui_locales", parameters.uiLocales);
  setIfPresent(searchParams, "acr_values", parameters.acrValues);
  setIfPresent(searchParams, "claims_locales", parameters.claimsLocales);
  setIfPresent(searchParams, "id_token_hint", parameters.idTokenHint);
}
