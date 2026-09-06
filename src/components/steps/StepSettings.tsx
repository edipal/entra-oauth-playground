"use client";
import React from "react";
import { InputText } from "primereact/inputtext";
import { InputSwitch } from "primereact/inputswitch";
import { Tooltip } from "primereact/tooltip";
import LabelWithHelp from "@/components/LabelWithHelp";
import type { IdentityProviderId } from "@/lib/identityProvider";
import { isEntraProvider } from "@/lib/identityProvider";
import { TranslationUtils } from "@/lib/translation";

type Props = {
  t: (key: string, values?: Record<string, string>) => string;
  safeT: (key: string) => string;
  providerId: IdentityProviderId;
  tenantId: string;
  setTenantId: (v: string) => void;
  issuerUrl: string;
  setIssuerUrl: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  redirectUri: string;
  scopes: string;
  setScopes: (v: string) => void;
  audience: string;
  setAudience: (v: string) => void;
  streamlined: boolean;
  setStreamlined: (v: boolean) => void;
  pkceEnabled: boolean;
  setPkceEnabled: (v: boolean) => void;
  resolvedAuthEndpoint: string;
  resolvedTokenEndpoint: string;
  endpointOverrideEnabled: boolean;
  setEndpointOverrideEnabled: (v: boolean) => void;
  authEndpointOverride: string;
  setAuthEndpointOverride: (v: string) => void;
  tokenEndpointOverride: string;
  setTokenEndpointOverride: (v: string) => void;
  providerConfigValid: boolean;
  tenantIdValid: boolean;
  issuerUrlValid: boolean;
  clientIdValid: boolean;
  redirectUriValid: boolean;
  discoveryLoading?: boolean;
  discoveryError?: string;
  showPkceToggle?: boolean;
  dpopEnabled?: boolean;
  setDpopEnabled?: (v: boolean) => void;
  showDpopToggle?: boolean;
  dpopJkt?: string;
  dpopPublicJwk?: any;
  onRegenerateDpopKey?: () => void;
  showRedirectUri?: boolean;
  showAuthEndpoint?: boolean;
  showAudience?: boolean;
};

function getClientIdErrorMessage(
  isEntra: boolean,
  clientId: string,
  t: (key: string) => string,
): string {
  if (!isEntra) {
    return t("errors.clientIdRequiredGeneric");
  }
  return clientId
    ? t("errors.clientIdInvalid")
    : t("errors.clientIdRequired");
}

export default function AuthCodeStepSettingsCommon(props: Readonly<Props>) {
  const {
    t,
    safeT,
    providerId,
    tenantId,
    setTenantId,
    issuerUrl,
    setIssuerUrl,
    clientId,
    setClientId,
    redirectUri,
    scopes,
    setScopes,
    audience,
    setAudience,
    streamlined,
    setStreamlined,
    pkceEnabled,
    setPkceEnabled,
    resolvedAuthEndpoint,
    resolvedTokenEndpoint,
    endpointOverrideEnabled,
    setEndpointOverrideEnabled,
    authEndpointOverride,
    setAuthEndpointOverride,
    tokenEndpointOverride,
    setTokenEndpointOverride,
    providerConfigValid,
    tenantIdValid,
    issuerUrlValid,
    clientIdValid,
    redirectUriValid,
    discoveryLoading = false,
    discoveryError = "",
    showPkceToggle = true,
    dpopEnabled = false,
    setDpopEnabled,
    showDpopToggle = true,
    dpopJkt = "",
    dpopPublicJwk,
    onRegenerateDpopKey,
    showRedirectUri = true,
    showAuthEndpoint = true,
    showAudience = false,
  } = props;

  // safe translation helper: if the key is missing return the provided fallback or an empty string
  const maybeT = (key: string, fallback = ""): string =>
    TranslationUtils.maybeT(t, key, fallback);

  const localStorageIconId = "local-storage-notice-icon";
  const isEntra = isEntraProvider(providerId);

  return (
    <>
      <p>{t("sections.settings.description")}</p>

      <div className="mt-5">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <h5
            style={{
              margin: 0,
              display: "inline-flex",
              alignItems: "center",
              lineHeight: "1.25",
              verticalAlign: "middle",
              paddingTop: "2px",
            }}
          >
            {maybeT(
              "sections.settings.userProvidedTitle",
              "User-provided settings",
            )}
          </h5>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginLeft: "0.5rem",
            }}
          >
            <i
              id={localStorageIconId}
              className="pi pi-exclamation-circle p-ml-3"
              aria-label={maybeT(
                "sections.settings.localStorageNotice",
                "These values will be saved in your browser's local storage for convenience.",
              )}
              role="img"
              style={{
                color: "var(--yellow-500)",
                fontSize: "1rem",
                display: "inline-flex",
                alignItems: "center",
                verticalAlign: "middle",
                lineHeight: "1",
                alignSelf: "center",
              }}
            />
            <Tooltip
              target={`#${localStorageIconId}`}
              content={maybeT(
                "sections.settings.localStorageNotice",
                "These values will be saved in your browser's local storage for convenience.",
              )}
              style={{ fontSize: "0.85rem" }}
            />
          </div>
        </div>

        <p className="mb-3 mt-3 text-sm opacity-75">
          {maybeT(
            "sections.settings.userProvidedDescription",
            "These fields are configurable by you and are used to build the authorization request.",
          )}
        </p>

        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12 md:col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(15rem, 20rem) 1fr",
                alignItems: "center",
                columnGap: "1rem",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id={isEntra ? "tenantId" : "issuerUrl"}
                  text={isEntra ? t("labels.tenantId") : t("labels.issuerUrl")}
                  help={isEntra ? t("help.tenantId") : t("help.issuerUrl")}
                />
              </div>
              <div>
                {isEntra ? (
                  <InputText
                    id="tenantId"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder={t("placeholders.tenantId")}
                    className={tenantIdValid ? "" : "p-invalid"}
                    style={{ width: "100%" }}
                  />
                ) : (
                  <InputText
                    id="issuerUrl"
                    value={issuerUrl}
                    onChange={(e) => setIssuerUrl(e.target.value)}
                    placeholder={t(`placeholders.issuerUrl.${providerId}`)}
                    className={issuerUrlValid ? "" : "p-invalid"}
                    style={{ width: "100%" }}
                  />
                )}
                {isEntra && !tenantIdValid && (
                  <small className="p-error block mt-1">
                    {t("errors.tenantIdInvalid")}
                  </small>
                )}
                {!isEntra && !issuerUrlValid && (
                  <small className="p-error block mt-1">
                    {t("errors.issuerUrlInvalid")}
                  </small>
                )}
                {!isEntra && issuerUrlValid && discoveryLoading && (
                  <small className="block mt-1 opacity-75">
                    {t("status.discoveryLoading")}
                  </small>
                )}
                {!isEntra && providerConfigValid && discoveryError && (
                  <small className="p-error block mt-1">
                    {t("errors.discoveryFailed", { error: discoveryError })}
                  </small>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 md:col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(15rem, 20rem) 1fr",
                alignItems: "center",
                columnGap: "1rem",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="clientId"
                  text={t("labels.clientId")}
                  help={t("help.clientId")}
                />
              </div>
              <div>
                <InputText
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder={t("placeholders.clientId")}
                  className={clientIdValid ? "" : "p-invalid"}
                  style={{ width: "100%" }}
                />
                {!clientIdValid && (
                  <small className="p-error block mt-1">
                    {getClientIdErrorMessage(isEntra, clientId, t)}
                  </small>
                )}
              </div>
            </div>
          </div>

          {showAudience && (
            <div className="col-12 md:col-12">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(15rem, 20rem) 1fr",
                  alignItems: "center",
                  columnGap: "1rem",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <LabelWithHelp
                    id="audience"
                    text={t("labels.audience")}
                    help={t("help.audience")}
                  />
                </div>
                <div>
                  <InputText
                    id="audience"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder={t("placeholders.audience")}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="col-12 md:col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(15rem, 20rem) 1fr",
                alignItems: "center",
                columnGap: "1rem",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="scopes"
                  text={t("labels.scopes")}
                  help={t("help.scopes")}
                />
              </div>
              <div>
                <InputText
                  id="scopes"
                  value={scopes}
                  onChange={(e) => setScopes(e.target.value)}
                  placeholder={t("placeholders.scopes")}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>

          <div className="col-12 md:col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(15rem, 20rem) 1fr",
                alignItems: "center",
                columnGap: "1rem",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="streamlined"
                  text={t("labels.streamlined")}
                  help={t("help.streamlined")}
                />
              </div>
              <div>
                <div className="flex align-items-center gap-2">
                  <InputSwitch
                    inputId="streamlined"
                    checked={!!streamlined}
                    onChange={(e) => setStreamlined(!!e.value)}
                  />
                  <label htmlFor="streamlined" className="m-0">
                    {streamlined
                      ? t("toggles.streamlinedOn")
                      : t("toggles.streamlinedOff")}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {showPkceToggle && (
            <div className="col-12 md:col-12">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(15rem, 20rem) 1fr",
                  alignItems: "center",
                  columnGap: "1rem",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <LabelWithHelp
                    id="pkceEnabled"
                    text={t("labels.pkceEnabled")}
                    help={t("help.pkceEnabled")}
                  />
                </div>
                <div>
                  <div className="flex align-items-center gap-2">
                    <InputSwitch
                      inputId="pkceEnabled"
                      checked={!!pkceEnabled}
                      onChange={(e) => setPkceEnabled(!!e.value)}
                    />
                    <label htmlFor="pkceEnabled" className="m-0">
                      {pkceEnabled
                        ? t("toggles.pkceEnabledOn")
                        : t("toggles.pkceEnabledOff")}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showDpopToggle && setDpopEnabled && (
            <div className="col-12 md:col-12">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(15rem, 20rem) 1fr",
                  alignItems: "center",
                  columnGap: "1rem",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <LabelWithHelp
                    id="dpopEnabled"
                    text={maybeT("labels.dpopEnabled", "Use DPoP (RFC 9449)")}
                    help={maybeT(
                      "help.dpopEnabled",
                      "Demonstrating Proof-of-Possession binds issued tokens and authorization codes to an asymmetric key pair held by the browser, preventing token replay attacks.",
                    )}
                  />
                </div>
                <div>
                  <div className="flex align-items-center gap-2">
                    <InputSwitch
                      inputId="dpopEnabled"
                      checked={!!dpopEnabled}
                      onChange={(e) => setDpopEnabled(!!e.value)}
                    />
                    <label htmlFor="dpopEnabled" className="m-0">
                      {dpopEnabled
                        ? maybeT("toggles.dpopEnabledOn", "Enabled")
                        : maybeT("toggles.dpopEnabledOff", "Disabled")}
                    </label>
                  </div>
                </div>
              </div>

              {dpopEnabled && dpopJkt && (
                <div
                  id="dpopKeyDetails"
                  className="mt-3 p-3 surface-50 border-round border-1 surface-border"
                  style={{ marginLeft: "clamp(0px, 15rem, 20rem)" }}
                >
                  <div className="flex justify-content-between align-items-center mb-2">
                    <span className="font-semibold text-sm">
                      {maybeT(
                        "labels.dpopKeyDetails",
                        "DPoP Client Key (ES256 / P-256)",
                      )}
                    </span>
                    {onRegenerateDpopKey && (
                      <button
                        type="button"
                        className="p-button p-button-sm p-button-text p-button-secondary"
                        onClick={onRegenerateDpopKey}
                        style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem" }}
                      >
                        <i className="pi pi-refresh mr-1" />
                        {maybeT("buttons.regenerateDpopKey", "Regenerate Key")}
                      </button>
                    )}
                  </div>
                  <div className="text-xs mb-2">
                    <span className="opacity-75">
                      {maybeT(
                        "labels.dpopThumbprint",
                        "JWK Thumbprint (dpop_jkt):",
                      )}{" "}
                    </span>
                    <code id="dpopThumbprint" className="select-all font-bold">{dpopJkt}</code>
                  </div>
                  {dpopPublicJwk && (
                    <details className="text-xs">
                      <summary className="cursor-pointer opacity-75">
                        {maybeT("labels.dpopPublicJwk", "View Public JWK")}
                      </summary>
                      <pre className="mt-1 p-2 surface-100 border-round overflow-x-auto">
                        {JSON.stringify(dpopPublicJwk, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ResolvedEndpointsSection
        t={t}
        safeT={safeT}
        maybeT={maybeT}
        endpointOverrideEnabled={endpointOverrideEnabled}
        setEndpointOverrideEnabled={setEndpointOverrideEnabled}
        showAuthEndpoint={showAuthEndpoint}
        authEndpointOverride={authEndpointOverride}
        setAuthEndpointOverride={setAuthEndpointOverride}
        resolvedAuthEndpoint={resolvedAuthEndpoint}
        tokenEndpointOverride={tokenEndpointOverride}
        setTokenEndpointOverride={setTokenEndpointOverride}
        resolvedTokenEndpoint={resolvedTokenEndpoint}
        showRedirectUri={showRedirectUri}
        redirectUri={redirectUri}
        redirectUriValid={redirectUriValid}
      />
    </>
  );
}

type ResolvedEndpointsSectionProps = {
  t: (key: string) => string;
  safeT: (key: string, fallback?: string) => string;
  maybeT: (key: string, fallback?: string) => string;
  endpointOverrideEnabled: boolean;
  setEndpointOverrideEnabled: (value: boolean) => void;
  showAuthEndpoint?: boolean;
  authEndpointOverride: string;
  setAuthEndpointOverride: (value: string) => void;
  resolvedAuthEndpoint: string;
  tokenEndpointOverride: string;
  setTokenEndpointOverride: (value: string) => void;
  resolvedTokenEndpoint: string;
  showRedirectUri?: boolean;
  redirectUri: string;
  redirectUriValid: boolean;
};

function ResolvedEndpointsSection(props: Readonly<ResolvedEndpointsSectionProps>) {
  const {
    t,
    safeT,
    maybeT,
    endpointOverrideEnabled,
    setEndpointOverrideEnabled,
    showAuthEndpoint = true,
    authEndpointOverride,
    setAuthEndpointOverride,
    resolvedAuthEndpoint,
    tokenEndpointOverride,
    setTokenEndpointOverride,
    resolvedTokenEndpoint,
    showRedirectUri = true,
    redirectUri,
    redirectUriValid,
  } = props;

  return (
    <div className="mt-5">
      <h5 className="mb-2">
        {maybeT(
          "sections.settings.resolvedTitle",
          "Resolved (read-only) values",
        )}
      </h5>
      <p className="mb-3 mt-3 text-sm opacity-75">
        {maybeT(
          "sections.settings.resolvedDescription",
          "These values are derived from the provider and other inputs. Enable endpoint overrides to edit them.",
        )}
      </p>

      <div className="grid formgrid p-fluid gap-3">
        <div className="col-12 md:col-12">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(15rem, 20rem) 1fr",
              alignItems: "center",
              columnGap: "1rem",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <LabelWithHelp
                id="endpointOverrideEnabled"
                text={t("labels.endpointOverride")}
                help={t("help.endpointOverride")}
              />
            </div>
            <div>
              <div className="flex align-items-center gap-2">
                <InputSwitch
                  inputId="endpointOverrideEnabled"
                  checked={!!endpointOverrideEnabled}
                  onChange={(e) => setEndpointOverrideEnabled(!!e.value)}
                />
                <label htmlFor="endpointOverrideEnabled" className="m-0">
                  {endpointOverrideEnabled
                    ? t("toggles.endpointOverrideOn")
                    : t("toggles.endpointOverrideOff")}
                </label>
              </div>
            </div>
          </div>
        </div>

        {showAuthEndpoint && (
          <div className="col-12 md:col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(15rem, 20rem) 1fr",
                alignItems: "center",
                columnGap: "1rem",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="authEndpoint"
                  text={t("labels.authEndpoint")}
                  help={safeT("help.authEndpoint")}
                />
              </div>
              <div>
                <InputText
                  id="authEndpoint"
                  value={
                    endpointOverrideEnabled
                      ? authEndpointOverride || resolvedAuthEndpoint
                      : resolvedAuthEndpoint
                  }
                  onChange={(e) => setAuthEndpointOverride(e.target.value)}
                  readOnly={!endpointOverrideEnabled}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="col-12 md:col-12">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(15rem, 20rem) 1fr",
              alignItems: "center",
              columnGap: "1rem",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <LabelWithHelp
                id="tokenEndpoint"
                text={t("labels.tokenEndpoint")}
                help={safeT("help.tokenEndpoint")}
              />
            </div>
            <div>
              <InputText
                id="tokenEndpoint"
                value={
                  endpointOverrideEnabled
                    ? tokenEndpointOverride || resolvedTokenEndpoint
                    : resolvedTokenEndpoint
                }
                onChange={(e) => setTokenEndpointOverride(e.target.value)}
                readOnly={!endpointOverrideEnabled}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>

        {showRedirectUri && (
          <div className="col-12 md:col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(15rem, 20rem) 1fr",
                alignItems: "center",
                columnGap: "1rem",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="redirectUri"
                  text={t("labels.redirectUri")}
                  help={t("help.redirectUri")}
                />
              </div>
              <div>
                <InputText
                  id="redirectUri"
                  value={redirectUri}
                  readOnly
                  className={redirectUriValid ? "" : "p-invalid"}
                  style={{ width: "100%" }}
                />
                {!redirectUriValid && (
                  <small className="p-error block mt-1">
                    {t("errors.redirectUriInvalid")}
                  </small>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
