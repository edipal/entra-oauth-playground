"use client";
import { useState, useMemo } from "react";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { useTranslations } from "next-intl";
import LabelWithHelp from "@/components/LabelWithHelp";

type Props = {
  apiEndpointUrl: string;
  setApiEndpointUrl: (v: string) => void;
  accessToken: string;
  apiResponseText: string;
  callingApi: boolean;
  onCallApi: () => void | Promise<void>;
  dpopEnabled?: boolean;
  dpopProof?: string;
};

export default function StepCallApi({
  apiEndpointUrl,
  setApiEndpointUrl,
  accessToken,
  apiResponseText,
  callingApi,
  onCallApi,
  dpopEnabled,
  dpopProof,
}: Readonly<Props>) {
  const t = useTranslations("StepCallApi");
  const [showDpopDetails, setShowDpopDetails] = useState(true);

  const headersPreview = useMemo(() => {
    if (!accessToken) return "";
    if (dpopEnabled) {
      const proofLine = dpopProof
        ? `\nDPoP: ${dpopProof}`
        : "\nDPoP: <dpop_proof_jwt>";
      return `Authorization: DPoP ${accessToken}${proofLine}`;
    }
    return `Authorization: Bearer ${accessToken}`;
  }, [accessToken, dpopEnabled, dpopProof]);

  const decodedDpopProof = useMemo(() => {
    if (!dpopProof) return { header: "", payload: "" };
    try {
      const parts = dpopProof.split(".");
      if (parts.length < 2) return { header: "", payload: "" };
      const decodeBase64Url = (str: string) => {
        const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
        const json = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join(""),
        );
        return JSON.stringify(JSON.parse(json), null, 2);
      };
      return {
        header: decodeBase64Url(parts[0]),
        payload: decodeBase64Url(parts[1]),
      };
    } catch {
      return { header: "", payload: "" };
    }
  }, [dpopProof]);

  return (
    <section>
      <p className="mb-3">{t("sections.callApi.description")}</p>
      <div className="mb-4 surface-0 py-3 px-0 border-round">
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
                  id="apiEndpoint"
                  text={t("labels.apiEndpoint")}
                  help={t("help.apiEndpoint")}
                />
              </div>
              <div>
                <InputText
                  id="apiEndpoint"
                  value={apiEndpointUrl}
                  onChange={(e) => setApiEndpointUrl(e.target.value)}
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
                  id="apiHeaders"
                  text={t("labels.apiHeaders")}
                  help={t("help.apiHeaders")}
                />
              </div>
              <div>
                <InputTextarea
                  id="apiHeaders"
                  rows={dpopEnabled ? 5 : 3}
                  autoResize
                  value={headersPreview}
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

          {dpopEnabled && (
            <div className="col-12">
              <div className="surface-0 p-3 border-round border-1 surface-border">
                <div className="flex align-items-center justify-content-between mb-2">
                  <div className="flex align-items-center gap-2">
                    <span className="font-semibold text-sm">
                      {t("dpop.cardTitle")}
                    </span>
                    <Tag
                      value={t("dpop.badge")}
                      severity="info"
                      title={t("dpop.badgeHelp")}
                    />
                  </div>
                  {dpopProof && (
                    <Button
                      type="button"
                      icon={`pi ${showDpopDetails ? "pi-chevron-up" : "pi-chevron-down"}`}
                      text
                      size="small"
                      onClick={() => setShowDpopDetails((prev) => !prev)}
                      aria-label="Toggle DPoP details"
                    />
                  )}
                </div>

                {dpopProof && showDpopDetails ? (
                  <div className="grid formgrid p-fluid gap-3">
                    <div className="col-12">
                      <LabelWithHelp
                        id="rawApiDpopProof"
                        text={t("dpop.rawProof")}
                        help={t("dpop.proofHelp")}
                      />
                      <InputTextarea
                        id="rawApiDpopProof"
                        value={dpopProof}
                        rows={2}
                        autoResize
                        readOnly
                        style={{ width: "100%", fontFamily: "monospace" }}
                      />
                    </div>

                    <div className="col-12 md:col-6">
                      <label
                        htmlFor="decodedApiDpopHeader"
                        className="font-semibold text-sm mb-1 block"
                      >
                        {t("dpop.decodedHeader")}
                      </label>
                      <InputTextarea
                        id="decodedApiDpopHeader"
                        value={decodedDpopProof.header}
                        rows={6}
                        autoResize
                        readOnly
                        style={{ width: "100%", fontFamily: "monospace" }}
                      />
                    </div>

                    <div className="col-12 md:col-6">
                      <label
                        htmlFor="decodedApiDpopPayload"
                        className="font-semibold text-sm mb-1 block"
                      >
                        {t("dpop.decodedPayload")}
                      </label>
                      <InputTextarea
                        id="decodedApiDpopPayload"
                        value={decodedDpopProof.payload}
                        rows={6}
                        autoResize
                        readOnly
                        style={{ width: "100%", fontFamily: "monospace" }}
                      />
                    </div>
                  </div>
                ) : dpopProof ? (
                  <p className="text-sm opacity-75 m-0">{t("dpop.athHelp")}</p>
                ) : (
                  <p className="text-sm opacity-75 m-0">
                    {t("dpop.proofPending")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="col-12">
            <div className="flex mt-3 mb-3">
              <Button
                type="button"
                label={callingApi ? t("buttons.sending") : t("buttons.sendGet")}
                icon="pi pi-send"
                className="w-full"
                onClick={onCallApi}
                disabled={callingApi || !apiEndpointUrl || !accessToken}
              />
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
                  id="apiResponse"
                  text={t("labels.apiResponse")}
                  help={t("help.apiResponse")}
                />
              </div>
              <div>
                <InputTextarea
                  id="apiResponse"
                  rows={6}
                  autoResize
                  value={apiResponseText}
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
