"use client";
import type { ReactNode } from "react";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { useTranslations } from "next-intl";
import LabelWithHelp from "@/components/LabelWithHelp";

export type ParConfig = {
  parEndpoint: string;
  parRequestPreview: string;
  parStatus: number | null;
  parResponseText: string;
  pushingPar: boolean;
  /** The result is ignored here; the caller keeps the request_uri it returns. */
  onPushPar: () => unknown;
  pushedRequestUri?: string;
  /**
   * Why the push failed. It belongs to this card rather than to the launch error
   * below, which reports what happened after a request_uri was obtained.
   */
  parError?: string;
};

type Props = {
  responseType: string;
  stateParam: string;
  setStateParam: (v: string) => void;
  onGenerateState: () => void;
  nonce: string;
  setNonce: (v: string) => void;
  onGenerateNonce: () => void;
  responseMode: string;
  setResponseMode: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  loginHint: string;
  setLoginHint: (v: string) => void;
  authUrlPreview: string;
  onOpenPopup: () => void;
  advancedAuthorizationOptions?: ReactNode;
  authorizationLaunchError?: string;
  launchDisabled?: boolean;
  showResponseMode?: boolean;
  includeSelectAccountPrompt?: boolean;
  hideAdvanced?: boolean;
  parConfig?: ParConfig;
};

export default function StepAuthorize({
  responseType,
  stateParam,
  setStateParam,
  onGenerateState,
  nonce,
  setNonce,
  onGenerateNonce,
  responseMode,
  setResponseMode,
  prompt,
  setPrompt,
  loginHint,
  setLoginHint,
  authUrlPreview,
  onOpenPopup,
  advancedAuthorizationOptions,
  authorizationLaunchError,
  launchDisabled = false,
  showResponseMode = true,
  includeSelectAccountPrompt = true,
  hideAdvanced,
  parConfig,
}: Readonly<Props>) {
  const t = useTranslations("StepAuthorize");
  const responseModeOptions = [
    { label: t("options.responseMode.query"), value: "query" },
    { label: t("options.responseMode.form_post"), value: "form_post" },
  ];
  const promptOptions = [
    { label: t("options.prompt.login"), value: "login" },
    { label: t("options.prompt.consent"), value: "consent" },
    { label: t("options.prompt.none"), value: "none" },
  ];

  if (includeSelectAccountPrompt) {
    promptOptions.splice(2, 0, {
      label: t("options.prompt.select_account"),
      value: "select_account",
    });
  }
  return (
    <>
      <p>{t("sections.authorize.description")}</p>
      {/* Editable settings provided by the user */}
      <div className="surface-0 py-3 px-0 border-round mt-5">
        <h5>{t("sections.settings.userProvidedTitle")}</h5>
        <p className="text-sm opacity-75">
          {t("sections.settings.userProvidedDescription")}
        </p>

        <div className="grid formgrid p-fluid gap-3">
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
                  id="responseType"
                  text={t("labels.responseType")}
                  help={t("help.responseType")}
                />
              </div>
              <div>
                <InputText
                  id="responseType"
                  value={responseType}
                  readOnly
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
                alignItems: "center",
                columnGap: "0.5rem",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="state"
                  text={t("labels.state")}
                  help={t("help.state")}
                />
              </div>
              <div>
                <div className="flex gap-2 align-items-center">
                  <InputText
                    id="state"
                    value={stateParam}
                    onChange={(e) => setStateParam(e.target.value)}
                    placeholder={t("placeholders.state")}
                    style={{ width: "100%" }}
                  />
                  <Button
                    type="button"
                    icon="pi pi-refresh"
                    onClick={onGenerateState}
                    className="shadow-2"
                    aria-label={t("buttons.generate")}
                    title={t("buttons.generate")}
                    style={{
                      width: "3rem",
                      height: "3rem",
                      minWidth: "2rem",
                      padding: "0.45rem",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

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
                  id="nonce"
                  text={t("labels.nonce")}
                  help={t("help.nonce")}
                />
              </div>
              <div>
                <div className="flex gap-2 align-items-center">
                  <InputText
                    id="nonce"
                    value={nonce}
                    onChange={(e) => setNonce(e.target.value)}
                    placeholder={t("placeholders.nonce")}
                    style={{ width: "100%" }}
                  />
                  <Button
                    type="button"
                    icon="pi pi-refresh"
                    onClick={onGenerateNonce}
                    className="shadow-2"
                    aria-label={t("buttons.generate")}
                    title={t("buttons.generate")}
                    style={{
                      width: "3rem",
                      height: "3rem",
                      minWidth: "2rem",
                      padding: "0.45rem",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {!hideAdvanced && (
            <>
              {showResponseMode && (
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
                        id="responseMode"
                        text={t("labels.responseMode")}
                        help={t("help.responseMode")}
                      />
                    </div>
                    <div>
                      <Dropdown
                        inputId="responseMode"
                        value={responseMode}
                        onChange={(e) => setResponseMode(e.value)}
                        options={responseModeOptions}
                        placeholder={t("placeholders.selectMethod")}
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>
                </div>
              )}

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
                      id="prompt"
                      text={t("labels.prompt")}
                      help={t("help.prompt")}
                    />
                  </div>
                  <div>
                    <Dropdown
                      inputId="prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.value)}
                      options={promptOptions}
                      placeholder={t("placeholders.selectMethod")}
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
                    alignItems: "center",
                    columnGap: "0.5rem",
                  }}
                >
                  <div style={{ textAlign: "left" }}>
                    <LabelWithHelp
                      id="loginHint"
                      text={t("labels.loginHint")}
                      help={t("help.loginHint")}
                    />
                  </div>
                  <div>
                    <InputText
                      id="loginHint"
                      value={loginHint}
                      onChange={(e) => setLoginHint(e.target.value)}
                      placeholder={t("placeholders.loginHint")}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              </div>

              {advancedAuthorizationOptions}
            </>
          )}
        </div>
      </div>

      {/* Read-only resolved values */}
      {parConfig ? (
        <>
          {/* Phase 1: Pushed Authorization Request (PAR) */}
          <div className="surface-0 py-3 px-0 border-round mt-5">
            <h4 className="mt-0 mb-2">{t("sections.par.title")}</h4>
            <p className="text-sm opacity-75 mt-0 mb-3">
              {t("sections.par.description")}
            </p>

            <div className="grid formgrid p-fluid gap-3">
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
                      id="parEndpointPreview"
                      text={t("labels.parEndpoint")}
                      help={t("help.parEndpoint")}
                    />
                  </div>
                  <div>
                    <InputTextarea
                      id="parEndpointPreview"
                      rows={1}
                      autoResize
                      value={parConfig.parEndpoint}
                      readOnly
                      style={{ width: "100%", fontFamily: "monospace" }}
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
                      id="parRequestPreview"
                      text={t("labels.parRequest")}
                      help={t("help.parRequest")}
                    />
                  </div>
                  <div>
                    <InputTextarea
                      id="parRequestPreview"
                      rows={6}
                      autoResize
                      value={parConfig.parRequestPreview}
                      readOnly
                      style={{ width: "100%", fontFamily: "monospace" }}
                    />
                  </div>
                </div>
              </div>

              <div className="col-12">
                <Button
                  type="button"
                  id="pushParButton"
                  className="w-full"
                  label={
                    parConfig.pushingPar
                      ? t("buttons.pushingPar")
                      : t("buttons.pushPar")
                  }
                  icon={
                    parConfig.pushingPar
                      ? "pi pi-spin pi-spinner"
                      : "pi pi-send"
                  }
                  onClick={() => parConfig.onPushPar()}
                  disabled={parConfig.pushingPar || launchDisabled}
                />
                {parConfig.parError && (
                  <small className="p-error block mt-2">
                    {parConfig.parError}
                  </small>
                )}
              </div>

              {parConfig.parResponseText && (
                <div className="col-12 mt-2">
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
                        id="parResponseText"
                        text={
                          parConfig.parStatus
                            ? `${t("labels.parResponse")} (${parConfig.parStatus})`
                            : t("labels.parResponse")
                        }
                        help={t("help.parResponse")}
                      />
                    </div>
                    <div>
                      <InputTextarea
                        id="parResponseText"
                        rows={5}
                        autoResize
                        value={parConfig.parResponseText}
                        readOnly
                        style={{ width: "100%", fontFamily: "monospace" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Phase 2: Browser Authorization */}
          <div className="surface-0 py-3 px-0 border-round mt-4">
            <h4 className="mt-0 mb-2">{t("sections.par.browserTitle")}</h4>
            <h5>{t("help.browserAuthUrl")}</h5>

            <div className="grid formgrid p-fluid gap-3">
              <div className="col-12">
                <InputTextarea
                  id="authUrlPreview"
                  rows={4}
                  autoResize
                  value={authUrlPreview}
                  readOnly
                  style={{ fontFamily: "monospace" }}
                />
              </div>

              <div className="col-12">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="w-full"
                    label={t("buttons.openPopup")}
                    icon="pi pi-external-link"
                    onClick={onOpenPopup}
                    disabled={!authUrlPreview || launchDisabled}
                  />
                </div>
                {authorizationLaunchError && (
                  <small className="p-error block mt-2">
                    {authorizationLaunchError}
                  </small>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="surface-0 py-3 px-0 border-round mt-5">
          <h5>{t("help.authUrlPreview")}</h5>

          <div className="grid formgrid p-fluid gap-3">
            <div className="col-12">
              <InputTextarea
                id="authUrlPreview"
                rows={6}
                autoResize
                value={authUrlPreview}
                readOnly
              />
            </div>

            <div className="col-12">
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="w-full"
                  label={t("buttons.openPopup")}
                  icon="pi pi-external-link"
                  onClick={onOpenPopup}
                  disabled={!authUrlPreview || launchDisabled}
                />
              </div>
              {authorizationLaunchError && (
                <small className="p-error block mt-2">
                  {authorizationLaunchError}
                </small>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
