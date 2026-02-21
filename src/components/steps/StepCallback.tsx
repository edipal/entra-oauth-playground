"use client";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { useTranslations } from "next-intl";
import LabelWithHelp from "@/components/LabelWithHelp";

type Props = {
  callbackUrl: string;
  callbackBody?: string;
  authCode: string;
  extractedState: string;
  expectedState?: string;
};

export default function StepCallback({
  callbackUrl,
  callbackBody = "",
  authCode,
  extractedState,
  expectedState,
}: Props) {
  const t = useTranslations("StepCallback");
  // Parse callback params early so we can decide whether to show extracted fields
  let callbackParams: URLSearchParams | null = null;
  if (callbackBody && callbackBody.length > 0) {
    // response_mode=form_post: parse params from body
    callbackParams = new URLSearchParams(callbackBody);
  } else {
    // response_mode=query (GET): parse from URL query
    try {
      const url = new URL(callbackUrl);
      callbackParams = new URLSearchParams(url.search);
    } catch (e) {
      const q =
        callbackUrl && callbackUrl.includes("?")
          ? callbackUrl.split("?")[1]
          : "";
      callbackParams = new URLSearchParams(q);
    }
  }

  const cbError = callbackParams.get("error") ?? "";
  const cbErrorDescription = callbackParams.get("error_description") ?? "";
  const cbErrorUri = callbackParams.get("error_uri") ?? "";
  const hasCallbackError = !!(cbError || cbErrorDescription || cbErrorUri);
  const hasExpected = !!(expectedState && expectedState.length > 0);
  const stateMatches = hasExpected && expectedState === extractedState;
  return (
    <>
      <p>{t("sections.callback.description")}</p>
      <div className="mt-5 surface-0 py-3 px-0 border-round">
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(12rem, 14rem) 1fr",
                alignItems: "start",
                columnGap: "0.75rem",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="callbackUrl"
                  text={t("labels.callbackUrl")}
                  help={t("help.callbackUrl")}
                />
              </div>
              <div>
                <InputTextarea
                  id="callbackUrl"
                  rows={3}
                  autoResize
                  wrap="soft"
                  value={callbackUrl}
                  readOnly
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(12rem, 14rem) 1fr",
                alignItems: "start",
                columnGap: "0.75rem",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="callbackBody"
                  text={t("labels.callbackBody") ?? "POST body"}
                  help={
                    t("help.callbackBody") ??
                    "If response_mode=form_post, the identity provider sends parameters in the POST body."
                  }
                />
              </div>
              <div>
                <InputTextarea
                  id="callbackBody"
                  rows={3}
                  autoResize
                  wrap="soft"
                  value={callbackBody}
                  readOnly
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </div>
          {!hasCallbackError && (
            <>
              {authCode && (
                <div className="col-12">
                  <div
                    className="flex gap-2 align-items-center"
                    aria-live="polite"
                    style={{ lineHeight: 1 }}
                  >
                    <h5 className="m-0" style={{ lineHeight: 1 }}>
                      {t("sections.callback.okTitle") ?? "Callback OK"}
                    </h5>
                    <span
                      className="pi pi-check-circle mr-2"
                      style={{ color: "var(--green-500)" }}
                      aria-label="callback ok"
                    />
                  </div>
                </div>
              )}

              <div className="col-12">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(12rem, 14rem) 1fr",
                    alignItems: "center",
                    columnGap: "0.75rem",
                  }}
                >
                  <div style={{ textAlign: "left" }}>
                    <LabelWithHelp
                      id="authCode"
                      text={t("labels.extractedCode")}
                      help={t("help.extractedCode")}
                    />
                  </div>
                  <div>
                    <InputText
                      id="authCode"
                      value={authCode}
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
                    gridTemplateColumns: "minmax(12rem, 14rem) 1fr",
                    alignItems: "center",
                    columnGap: "0.75rem",
                  }}
                >
                  <div style={{ textAlign: "left" }}>
                    <LabelWithHelp
                      id="extractedState"
                      text={t("labels.extractedState")}
                      help={t("help.extractedState")}
                    />
                  </div>
                  <div>
                    <InputText
                      id="extractedState"
                      value={extractedState}
                      readOnly
                      style={{ width: "100%" }}
                    />
                    {hasExpected && (
                      <div
                        className="flex gap-2 align-items-center"
                        aria-live="polite"
                      >
                        {stateMatches ? (
                          <span
                            className="pi pi-check-circle mr-2"
                            style={{ color: "var(--green-500)" }}
                            aria-label="state valid"
                          />
                        ) : (
                          <span
                            className="pi pi-times-circle mr-2"
                            style={{ color: "var(--red-500)" }}
                            aria-label="state invalid"
                          />
                        )}
                        <span style={{ opacity: 0.9 }}>
                          {stateMatches
                            ? t("help.stateValid")
                            : t("help.stateInvalid")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
          {/* Callback error fields: render using parsed callback params (parsed earlier) */}
          {hasCallbackError && (
            <div className="col-12">
              <div className="flex gap-2 align-items-center" aria-live="polite">
                <h5 className="m-0" style={{ lineHeight: 1 }}>
                  {t("sections.callback.errorTitle") ?? "Callback error"}
                </h5>
                <span
                  className="pi pi-times-circle mr-2"
                  style={{ color: "var(--red-500)" }}
                  aria-label="callback error"
                />
              </div>
              <div className="surface-0 py-3 px-0 border-round">
                <div className="grid formgrid p-fluid gap-3">
                  <div className="col-12">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(12rem, 14rem) 1fr",
                        alignItems: "center",
                        columnGap: "0.75rem",
                      }}
                    >
                      <div style={{ textAlign: "left" }}>
                        <LabelWithHelp
                          id="callbackError"
                          text={t("labels.error") ?? "Error"}
                          help={t("help.error") ?? ""}
                        />
                      </div>
                      <div>
                        <InputText
                          id="callbackError"
                          value={cbError}
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
                        gridTemplateColumns: "minmax(12rem, 14rem) 1fr",
                        alignItems: "center",
                        columnGap: "0.75rem",
                      }}
                    >
                      <div style={{ textAlign: "left" }}>
                        <LabelWithHelp
                          id="callbackErrorUri"
                          text={t("labels.errorUri") ?? "Error URI"}
                          help={t("help.errorUri") ?? ""}
                        />
                      </div>
                      <div>
                        <InputText
                          id="callbackErrorUri"
                          value={cbErrorUri}
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
                        gridTemplateColumns: "minmax(12rem, 14rem) 1fr",
                        alignItems: "start",
                        columnGap: "0.75rem",
                      }}
                    >
                      <div style={{ textAlign: "left" }}>
                        <LabelWithHelp
                          id="callbackErrorDescription"
                          text={
                            t("labels.errorDescription") ?? "Error description"
                          }
                          help={t("help.errorDescription") ?? ""}
                        />
                      </div>
                      <div>
                        <InputTextarea
                          id="callbackErrorDescription"
                          rows={3}
                          autoResize
                          value={decodeURIComponent(cbErrorDescription)}
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
