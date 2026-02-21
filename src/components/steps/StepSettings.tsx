"use client";
import React from "react";
import { InputText } from "primereact/inputtext";
import { InputSwitch } from "primereact/inputswitch";
import { Tooltip } from "primereact/tooltip";
import LabelWithHelp from "@/components/LabelWithHelp";
import { TranslationUtils } from "@/lib/translation";

type Props = {
  t: (key: string) => string;
  safeT: (key: string) => string;
  tenantId: string;
  setTenantId: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  redirectUri: string;
  scopes: string;
  setScopes: (v: string) => void;
  streamlined: boolean;
  setStreamlined: (v: boolean) => void;
  pkceEnabled: boolean;
  setPkceEnabled: (v: boolean) => void;
  resolvedAuthEndpoint: string;
  resolvedTokenEndpoint: string;
  tenantIdValid: boolean;
  clientIdValid: boolean;
  redirectUriValid: boolean;
  showPkceToggle?: boolean;
  showRedirectUri?: boolean;
  showAuthEndpoint?: boolean;
};

export default function AuthCodeStepSettingsCommon(props: Props) {
  const {
    t,
    safeT,
    tenantId,
    setTenantId,
    clientId,
    setClientId,
    redirectUri,
    scopes,
    setScopes,
    streamlined,
    setStreamlined,
    pkceEnabled,
    setPkceEnabled,
    resolvedAuthEndpoint,
    resolvedTokenEndpoint,
    tenantIdValid,
    clientIdValid,
    redirectUriValid,
    showPkceToggle = true,
    showRedirectUri = true,
    showAuthEndpoint = true,
  } = props;

  // safe translation helper: if the key is missing return the provided fallback or an empty string
  const maybeT = (key: string, fallback = ""): string =>
    TranslationUtils.maybeT(t, key, fallback);

  const localStorageIconId = "local-storage-notice-icon";

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
                  id="tenantId"
                  text={t("labels.tenantId")}
                  help={t("help.tenantId")}
                />
              </div>
              <div>
                <InputText
                  id="tenantId"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder={t("placeholders.tenantId")}
                  className={!tenantIdValid ? "p-invalid" : ""}
                  style={{ width: "100%" }}
                />
                {!tenantIdValid && (
                  <small className="p-error block mt-1">
                    {t("errors.tenantIdInvalid")}
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
                  className={!clientIdValid ? "p-invalid" : ""}
                  style={{ width: "100%" }}
                />
                {!clientIdValid && (
                  <small className="p-error block mt-1">
                    {clientId
                      ? t("errors.clientIdInvalid")
                      : t("errors.clientIdRequired")}
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
        </div>
      </div>

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
            "These values are derived from the tenant and other inputs. They are shown for reference and cannot be changed here.",
          )}
        </p>

        <div className="grid formgrid p-fluid gap-3">
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
                    value={resolvedAuthEndpoint}
                    readOnly
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
                  value={resolvedTokenEndpoint}
                  readOnly
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
                    className={!redirectUriValid ? "p-invalid" : ""}
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
    </>
  );
}
