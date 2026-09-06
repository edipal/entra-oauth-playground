"use client";

import { useEffect } from "react";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Password } from "primereact/password";
import { useTranslations } from "next-intl";
import LabelWithHelp from "@/components/LabelWithHelp";
import type { AuthRequestMode } from "@/components/SettingsContext";
import type { Auth0AuthorizationParameters } from "@/lib/auth0AuthorizationParameters";

type Props = {
  authRequestMode: AuthRequestMode;
  setAuthRequestMode: (value: AuthRequestMode) => void;
  /**
   * Modes this client type can actually use. Auth0 supports PAR for confidential
   * clients only, so the public client passes `["url"]` and gets no selector.
   */
  supportedModes: AuthRequestMode[];
  parameters: Auth0AuthorizationParameters;
  setParameter: (
    name: keyof Auth0AuthorizationParameters,
    value: string,
  ) => void;
  rarJson: string;
  setRarJson: (value: string) => void;
  rarError?: string;
  /**
   * How the client authenticates. A PAR push is itself an authenticated call, so
   * `certificate` needs the signing key on this step too, not only the JAR modes.
   */
  clientAuthMethod?: "secret" | "certificate";
  setClientAuthMethod?: (value: "secret" | "certificate") => void;
  /**
   * Same runtime secret the client-authentication step edits, not a copy — a PAR
   * push made here has to send it before that step is reachable.
   */
  clientSecret?: string;
  setClientSecret?: (value: string) => void;
  /** Runtime-only signing key for the request object or the PAR push. */
  requestObjectKeyPem?: string;
  setRequestObjectKeyPem?: (value: string) => void;
  requestObjectKid?: string;
  setRequestObjectKid?: (value: string) => void;
};

const MODE_LABEL_KEYS: Record<AuthRequestMode, string> = {
  url: "options.mode.url",
  par: "options.mode.par",
  jar: "options.mode.jar",
  "par-jar": "options.mode.parJar",
};

export default function Auth0AuthorizationRequestOptions({
  authRequestMode,
  setAuthRequestMode,
  supportedModes,
  parameters,
  setParameter,
  rarJson,
  setRarJson,
  rarError,
  clientAuthMethod = "secret",
  setClientAuthMethod,
  clientSecret = "",
  setClientSecret,
  requestObjectKeyPem = "",
  setRequestObjectKeyPem,
  requestObjectKid = "",
  setRequestObjectKid,
}: Readonly<Props>) {
  const t = useTranslations("Auth0AuthorizationOptions");
  const rowStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(10rem, 14rem) 1fr",
    alignItems: "center",
    columnGap: "0.5rem",
  } as const;
  const modeOptions = supportedModes.map((mode) => ({
    label: t(MODE_LABEL_KEYS[mode]),
    value: mode,
  }));
  const authMethodOptions = [
    { label: t("methodOptions.secret"), value: "secret" },
    { label: t("methodOptions.auth0PrivateKey"), value: "certificate" },
  ];
  // A persisted mode this client type cannot use — left behind by a settings edit
  // or an older build — falls back to the plain URL request rather than silently
  // launching something else.
  const effectiveAuthRequestMode = supportedModes.includes(authRequestMode)
    ? authRequestMode
    : "url";
  const showModeSelector = supportedModes.length > 1;
  const signsRequestObject =
    effectiveAuthRequestMode === "jar" ||
    effectiveAuthRequestMode === "par-jar";
  const pushesRequest =
    effectiveAuthRequestMode === "par" ||
    effectiveAuthRequestMode === "par-jar";
  // Either the request object is signed here, or the push authenticates with the
  // key. Both need it before the client-authentication step is reached.
  const needsSigningKey =
    signsRequestObject || (pushesRequest && clientAuthMethod === "certificate");
  // The other half of the same rule: a push authenticated with a client secret
  // needs that secret here too, for exactly the same reason.
  const needsClientSecret = pushesRequest && clientAuthMethod === "secret";
  const signingKeyLabel = signsRequestObject
    ? t("labels.requestObjectKey")
    : t("labels.privateKey");
  const signingKeyHelp = signsRequestObject
    ? t("help.requestObjectKey")
    : t("help.privateKey");
  const signingKidLabel = signsRequestObject
    ? t("labels.requestObjectKid")
    : t("labels.clientAssertionKid");
  const signingKidHelp = signsRequestObject
    ? t("help.requestObjectKid")
    : t("help.clientAssertionKid");
  const signingKeyPlaceholder = signsRequestObject
    ? t("placeholders.requestObjectKey")
    : t("placeholders.privateKey");
  const signingKidPlaceholder = signsRequestObject
    ? t("placeholders.requestObjectKid")
    : t("placeholders.clientAssertionKid");
  const hasConnection = !!parameters.connection.trim();
  const hasOrganization = !!parameters.organization.trim();
  const modeDescriptionKeyByMode: Record<
    AuthRequestMode,
    "url" | "par" | "jar" | "parJar"
  > = {
    url: "url",
    par: "par",
    jar: "jar",
    "par-jar": "parJar",
  };

  useEffect(() => {
    if (effectiveAuthRequestMode !== authRequestMode) {
      setAuthRequestMode(effectiveAuthRequestMode);
    }
  }, [authRequestMode, effectiveAuthRequestMode, setAuthRequestMode]);

  return (
    <>
      {showModeSelector && (
        <>
          <div className="col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(10rem, 14rem) 1fr",
                alignItems: "center",
                columnGap: "0.5rem",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="auth0RequestMode"
                  text={t("labels.mode")}
                  help={t("help.mode")}
                />
              </div>
              <div>
                <Dropdown
                  inputId="auth0RequestMode"
                  value={effectiveAuthRequestMode}
                  onChange={(event) => setAuthRequestMode(event.value)}
                  options={modeOptions}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>

          <div className="col-12">
            <p className="mt-0 mb-0 text-sm opacity-75">
              {t(
                `modeDescriptions.${
                  modeDescriptionKeyByMode[effectiveAuthRequestMode]
                }`,
              )}
            </p>
          </div>
        </>
      )}

      {pushesRequest && setClientAuthMethod && (
        <div className="col-12">
          <div style={rowStyle}>
            <div style={{ textAlign: "left" }}>
              <LabelWithHelp
                id="auth0ClientAuthMethod"
                text={t("labels.clientAuthMethod")}
                help={t("help.clientAuthMethod")}
              />
            </div>
            <div>
              <Dropdown
                inputId="auth0ClientAuthMethod"
                value={clientAuthMethod}
                onChange={(event) =>
                  setClientAuthMethod(event.value as "secret" | "certificate")
                }
                options={authMethodOptions}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>
      )}

      {needsClientSecret && (
        <div className="col-12">
          <div style={rowStyle}>
            <div style={{ textAlign: "left" }}>
              <LabelWithHelp
                id="auth0ParClientSecret"
                text={t("labels.clientSecret")}
                help={t("help.clientSecret")}
              />
            </div>
            <div>
              <Password
                // `inputId`, not `id` — PrimeReact puts `id` on the wrapper div,
                // which would leave the label pointing at something unfocusable.
                inputId="auth0ParClientSecret"
                value={clientSecret}
                onChange={(event) => setClientSecret?.(event.target.value)}
                placeholder={t("placeholders.clientSecret")}
                variant="outlined"
                className="client-secret-password"
                toggleMask
                feedback={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Signed here, at the step that sends it — the client-authentication step
          comes later in the wizard, so a key entered there would arrive too late
          for a request object or an authenticated push. */}
      {needsSigningKey && (
        <>
          <div className="col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(10rem, 14rem) 1fr",
                alignItems: "start",
                columnGap: "0.5rem",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="auth0RequestObjectKey"
                  text={signingKeyLabel}
                  help={signingKeyHelp}
                />
              </div>
              <div>
                <InputTextarea
                  id="auth0RequestObjectKey"
                  rows={4}
                  autoResize
                  value={requestObjectKeyPem}
                  onChange={(event) =>
                    setRequestObjectKeyPem?.(event.target.value)
                  }
                  placeholder={signingKeyPlaceholder}
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="col-12">
            <div style={rowStyle}>
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="auth0RequestObjectKid"
                  text={signingKidLabel}
                  help={signingKidHelp}
                />
              </div>
              <div>
                <InputText
                  id="auth0RequestObjectKid"
                  value={requestObjectKid}
                  onChange={(event) =>
                    setRequestObjectKid?.(event.target.value)
                  }
                  placeholder={signingKidPlaceholder}
                  style={{ fontFamily: "monospace", width: "100%" }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      <div className="col-12">
        <div style={rowStyle}>
          <div style={{ textAlign: "left" }}>
            <LabelWithHelp
              id="auth0Connection"
              text={t("labels.connection")}
              help={t("help.connection")}
            />
          </div>
          <div>
            <InputText
              id="auth0Connection"
              value={parameters.connection}
              onChange={(event) =>
                setParameter("connection", event.target.value)
              }
              placeholder={t("placeholders.connection")}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </div>

      {hasConnection && (
        <div className="col-12">
          <div style={rowStyle}>
            <div style={{ textAlign: "left" }}>
              <LabelWithHelp
                id="auth0ConnectionScope"
                text={t("labels.connectionScope")}
                help={t("help.connectionScope")}
              />
            </div>
            <div>
              <InputText
                id="auth0ConnectionScope"
                value={parameters.connectionScope}
                onChange={(event) =>
                  setParameter("connectionScope", event.target.value)
                }
                placeholder={t("placeholders.connectionScope")}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="col-12">
        <div style={rowStyle}>
          <div style={{ textAlign: "left" }}>
            <LabelWithHelp
              id="auth0Organization"
              text={t("labels.organization")}
              help={t("help.organization")}
            />
          </div>
          <div>
            <InputText
              id="auth0Organization"
              value={parameters.organization}
              onChange={(event) =>
                setParameter("organization", event.target.value)
              }
              placeholder={t("placeholders.organization")}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </div>

      {hasOrganization && (
        <div className="col-12">
          <div style={rowStyle}>
            <div style={{ textAlign: "left" }}>
              <LabelWithHelp
                id="auth0Invitation"
                text={t("labels.invitation")}
                help={t("help.invitation")}
              />
            </div>
            <div>
              <InputText
                id="auth0Invitation"
                value={parameters.invitation}
                onChange={(event) =>
                  setParameter("invitation", event.target.value)
                }
                placeholder={t("placeholders.invitation")}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="col-12">
        <div style={rowStyle}>
          <div style={{ textAlign: "left" }}>
            <LabelWithHelp
              id="auth0ScreenHint"
              text={t("labels.screenHint")}
              help={t("help.screenHint")}
            />
          </div>
          <div>
            <Dropdown
              inputId="auth0ScreenHint"
              value={parameters.screenHint}
              onChange={(event) => setParameter("screenHint", event.value)}
              options={[
                { label: t("options.screenHint.login"), value: "login" },
                { label: t("options.screenHint.signup"), value: "signup" },
              ]}
              placeholder={t("placeholders.screenHint")}
              showClear
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </div>

      <div className="col-12">
        <div style={rowStyle}>
          <div style={{ textAlign: "left" }}>
            <LabelWithHelp
              id="auth0MaxAge"
              text={t("labels.maxAge")}
              help={t("help.maxAge")}
            />
          </div>
          <div>
            <InputText
              id="auth0MaxAge"
              value={parameters.maxAge}
              onChange={(event) => setParameter("maxAge", event.target.value)}
              placeholder={t("placeholders.maxAge")}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </div>

      <div className="col-12">
        <div style={rowStyle}>
          <div style={{ textAlign: "left" }}>
            <LabelWithHelp
              id="auth0UiLocales"
              text={t("labels.uiLocales")}
              help={t("help.uiLocales")}
            />
          </div>
          <div>
            <InputText
              id="auth0UiLocales"
              value={parameters.uiLocales}
              onChange={(event) =>
                setParameter("uiLocales", event.target.value)
              }
              placeholder={t("placeholders.uiLocales")}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </div>

      <div className="col-12">
        <div style={rowStyle}>
          <div style={{ textAlign: "left" }}>
            <LabelWithHelp
              id="auth0AcrValues"
              text={t("labels.acrValues")}
              help={t("help.acrValues")}
            />
          </div>
          <div>
            <InputText
              id="auth0AcrValues"
              value={parameters.acrValues}
              onChange={(event) =>
                setParameter("acrValues", event.target.value)
              }
              placeholder={t("placeholders.acrValues")}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </div>

      <div className="col-12">
        <div style={rowStyle}>
          <div style={{ textAlign: "left" }}>
            <LabelWithHelp
              id="auth0ClaimsLocales"
              text={t("labels.claimsLocales")}
              help={t("help.claimsLocales")}
            />
          </div>
          <div>
            <InputText
              id="auth0ClaimsLocales"
              value={parameters.claimsLocales}
              onChange={(event) =>
                setParameter("claimsLocales", event.target.value)
              }
              placeholder={t("placeholders.claimsLocales")}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </div>

      <div className="col-12">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(10rem, 14rem) 1fr",
            alignItems: "start",
            columnGap: "0.5rem",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <LabelWithHelp
              id="auth0IdTokenHint"
              text={t("labels.idTokenHint")}
              help={t("help.idTokenHint")}
            />
          </div>
          <div>
            <InputTextarea
              id="auth0IdTokenHint"
              rows={3}
              autoResize
              value={parameters.idTokenHint}
              onChange={(event) =>
                setParameter("idTokenHint", event.target.value)
              }
              placeholder={t("placeholders.idTokenHint")}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </div>

      <div className="col-12">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(10rem, 14rem) 1fr",
            alignItems: "start",
            columnGap: "0.5rem",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <LabelWithHelp
              id="auth0RarJson"
              text={t("labels.rarJson")}
              help={t("help.rarJson")}
            />
          </div>
          <div>
            <InputTextarea
              id="auth0RarJson"
              rows={4}
              autoResize
              value={rarJson}
              onChange={(event) => setRarJson(event.target.value)}
              placeholder={t("placeholders.rarJson")}
              className={rarError ? "p-invalid" : undefined}
              aria-invalid={rarError ? true : undefined}
              aria-describedby={rarError ? "auth0RarJsonError" : undefined}
              style={{ width: "100%" }}
            />
            {rarError && (
              <small id="auth0RarJsonError" className="p-error block mt-1">
                {rarError}
              </small>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
