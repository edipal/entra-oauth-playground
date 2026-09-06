"use client";
import { useMemo } from "react";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { useTranslations } from "next-intl";
import LabelWithHelp from "@/components/LabelWithHelp";
import { TranslationUtils } from "@/lib/translation";
import { decodeJwt } from "@/lib/jwtDecode";
import type { TokenExchangeBlocker } from "@/lib/tokenExchangeReadiness";

type Props = {
  tokenRequestPreview: unknown;
  tokenResponseText: unknown;
  exchanging: boolean;
  onExchangeTokens: () => void | Promise<void>;
  resolvedTokenEndpoint?: string;
  /**
   * Set when Send was pressed but a precondition is unmet — see
   * findTokenExchangeBlocker. The button stays enabled so the reason can be shown
   * rather than left to be guessed from a screen that did not change.
   */
  blockedReason?: TokenExchangeBlocker | null;
  dpopEnabled?: boolean;
  dpopProof?: string;
  dpopNonceRetried?: boolean;
};

export default function StepTokens({
  tokenRequestPreview,
  tokenResponseText,
  exchanging,
  onExchangeTokens,
  resolvedTokenEndpoint,
  blockedReason,
  dpopEnabled = false,
  dpopProof = "",
  dpopNonceRetried = false,
}: Readonly<Props>) {
  const t = useTranslations("StepTokens");
  const safeTWithFallback = (key: string, fallback = ""): string =>
    TranslationUtils.safeTWithFallback(t, key, fallback);
  const toPretty = (v: unknown) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (
      typeof v === "number" ||
      typeof v === "boolean" ||
      typeof v === "bigint"
    )
      return String(v);
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return "[unserializable value]";
    }
  };
  const reqStr = toPretty(tokenRequestPreview);
  const resStr = toPretty(tokenResponseText);

  const decodedDpopProof = useMemo(() => {
    if (!dpopProof) return { header: "", payload: "" };
    return decodeJwt(dpopProof);
  }, [dpopProof]);

  const isDPoPTokenType = useMemo(() => {
    try {
      const parsed = JSON.parse(resStr);
      return (
        parsed &&
        typeof parsed === "object" &&
        parsed.token_type?.toLowerCase() === "dpop"
      );
    } catch {
      return false;
    }
  }, [resStr]);
  return (
    <>
      <section>
        <p className="mb-3">{t("sections.tokens.description")}</p>
      </section>

      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <h4 className="mt-0 mb-3">
          {t("sections.tokens.requestTitle", {
            default: t("labels.tokenRequest"),
          })}
        </h4>
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
                  id="tokenEndpointPreview"
                  text={safeTWithFallback(
                    "labels.tokenEndpointPreview",
                    safeTWithFallback("labels.tokenEndpoint", "Token endpoint"),
                  )}
                  help={safeTWithFallback("help.tokenEndpointPreview", "")}
                />
              </div>
              <div>
                <InputTextarea
                  id="tokenEndpointPreview"
                  rows={1}
                  autoResize
                  value={resolvedTokenEndpoint ?? ""}
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
                  id="tokenRequestBody"
                  text={t("labels.tokenRequest")}
                  help={t("help.tokenRequest")}
                />
              </div>
              <div>
                <InputTextarea
                  id="tokenRequestBody"
                  value={`${reqStr ?? ""}`}
                  autoResize
                  rows={3}
                  wrap="soft"
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
            <div className="flex gap-2 mt-3">
              <Button
                type="button"
                label={exchanging ? t("buttons.sending") : t("buttons.send")}
                icon="pi pi-send"
                onClick={onExchangeTokens}
                disabled={exchanging || !`${reqStr ?? ""}`}
              />
            </div>
            {blockedReason && (
              <p
                className="p-error mt-2 mb-0"
                role="alert"
                data-testid="tokenExchangeBlocked"
              >
                {t(`errors.blocked.${blockedReason}`)}
              </p>
            )}
          </div>
        </div>
      </div>

      {dpopEnabled && (
        <div className="mb-4 surface-0 py-3 px-0 border-round">
          <div className="flex align-items-center gap-2 mb-2">
            <h4 className="m-0">{t("dpop.proofTitle")}</h4>
            <LabelWithHelp
              id="dpopProofHelp"
              text=""
              help={t("dpop.proofHelp")}
            />
          </div>

          {dpopNonceRetried && (
            <div
              id="dpopNonceRetryNotice"
              className="p-message p-message-info mb-3"
            >
              <div className="p-message-wrapper py-2 px-3 flex align-items-center">
                <span className="pi pi-info-circle mr-2 text-primary"></span>
                <span className="p-message-text text-sm">
                  {t("dpop.nonceRetriedNotice")}
                </span>
              </div>
            </div>
          )}

          {dpopProof ? (
            <div className="grid formgrid p-fluid gap-3">
              <div className="col-12">
                <LabelWithHelp
                  id="rawDpopProof"
                  text={t("dpop.rawProof")}
                  help={t("dpop.proofHelp")}
                />
                <InputTextarea
                  id="rawDpopProof"
                  value={dpopProof}
                  rows={2}
                  autoResize
                  readOnly
                  style={{ width: "100%", fontFamily: "monospace" }}
                />
              </div>

              <div className="col-12 md:col-6">
                <label
                  htmlFor="decodedDpopHeader"
                  className="font-semibold text-sm mb-1 block"
                >
                  {t("dpop.decodedHeader")}
                </label>
                <InputTextarea
                  id="decodedDpopHeader"
                  value={decodedDpopProof.header}
                  rows={6}
                  autoResize
                  readOnly
                  style={{ width: "100%", fontFamily: "monospace" }}
                />
              </div>

              <div className="col-12 md:col-6">
                <label
                  htmlFor="decodedDpopPayload"
                  className="font-semibold text-sm mb-1 block"
                >
                  {t("dpop.decodedPayload")}
                </label>
                <InputTextarea
                  id="decodedDpopPayload"
                  value={decodedDpopProof.payload}
                  rows={6}
                  autoResize
                  readOnly
                  style={{ width: "100%", fontFamily: "monospace" }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm opacity-75 m-0">{t("dpop.proofPending")}</p>
          )}
        </div>
      )}

      <div className="surface-0 py-3 px-0 border-round">
        <div className="flex align-items-center gap-2 mb-3">
          <h4 className="m-0">
            {t("sections.tokens.responseTitle", {
              default: t("labels.responsePreview"),
            })}
          </h4>
          {isDPoPTokenType && (
            <Tag
              value={t("dpop.tokenTypeBadge")}
              severity="success"
              title={t("dpop.tokenTypeHelp")}
            />
          )}
        </div>
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <InputTextarea
              id="tokenResponse"
              value={`${resStr ?? ""}`}
              autoResize
              rows={3}
              wrap="soft"
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
    </>
  );
}
