"use client";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { useTranslations } from "next-intl";
import LabelWithHelp from "@/components/LabelWithHelp";

type Props = {
  codeVerifier: string;
  setCodeVerifier: (v: string) => void;
  codeChallenge: string;
  onGeneratePkce: () => void | Promise<void>;
  codeVerifierValid?: boolean;
  codeChallengeValid?: boolean;
};

export default function StepPkce({
  codeVerifier,
  setCodeVerifier,
  codeChallenge,
  onGeneratePkce,
  codeVerifierValid = true,
  codeChallengeValid = true,
}: Props) {
  const t = useTranslations("StepPkce");
  // consider a field invalid if it's empty OR the caller explicitly marks it invalid
  const hasCodeVerifier = !!(codeVerifier && codeVerifier.trim().length > 0);
  const hasCodeChallenge = !!(codeChallenge && codeChallenge.trim().length > 0);
  const showCodeVerifierInvalid =
    !hasCodeVerifier || codeVerifierValid === false;
  const showCodeChallengeInvalid =
    !hasCodeChallenge || codeChallengeValid === false;
  return (
    <>
      <p>{t("sections.pkce.description")}</p>
      <div className="mb-4 surface-0 py-3 px-0 border-round mt-5">
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12 md:col-12">
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
                  id="codeVerifier"
                  text={t("labels.codeVerifier")}
                  help={t("help.codeVerifier")}
                />
              </div>
              <div>
                <div className="flex gap-2 align-items-center">
                  <InputText
                    id="codeVerifier"
                    className={`flex-1${showCodeVerifierInvalid ? " p-invalid" : ""}`}
                    value={codeVerifier}
                    onChange={(e) => setCodeVerifier(e.target.value)}
                    placeholder={t("placeholders.codeVerifier")}
                    style={{ width: "100%" }}
                  />
                  <Button
                    type="button"
                    icon="pi pi-refresh"
                    onClick={onGeneratePkce}
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
                {showCodeVerifierInvalid && (
                  <small className="p-error block mt-1">
                    {t("errors.codeVerifierRequired")}
                  </small>
                )}
              </div>
            </div>
          </div>
          <div className="col-12 md:col-12">
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
                  id="codeChallenge"
                  text={t("labels.codeChallenge")}
                  help={t("help.codeChallenge")}
                />
              </div>
              <div>
                <InputText
                  id="codeChallenge"
                  value={codeChallenge}
                  onChange={() => {}}
                  placeholder={t("placeholders.codeChallenge")}
                  readOnly
                  className={showCodeChallengeInvalid ? "p-invalid" : ""}
                  style={{ width: "100%" }}
                />
                {showCodeChallengeInvalid && (
                  <small className="p-error block mt-1">
                    {t("errors.codeChallengeRequired")}
                  </small>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
