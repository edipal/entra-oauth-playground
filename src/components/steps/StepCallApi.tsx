"use client";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { useTranslations } from "next-intl";
import LabelWithHelp from "@/components/LabelWithHelp";

type Props = {
  apiEndpointUrl: string;
  setApiEndpointUrl: (v: string) => void;
  accessToken: string;
  apiResponseText: string;
  callingApi: boolean;
  onCallApi: () => void | Promise<void>;
};

export default function StepCallApi({
  apiEndpointUrl,
  setApiEndpointUrl,
  accessToken,
  apiResponseText,
  callingApi,
  onCallApi,
}: Props) {
  const t = useTranslations("StepCallApi");
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
                  rows={3}
                  autoResize
                  value={
                    accessToken ? `Authorization: Bearer ${accessToken}` : ""
                  }
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
