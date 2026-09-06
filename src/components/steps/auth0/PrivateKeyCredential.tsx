"use client";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { useTranslations } from "next-intl";
import LabelWithHelp from "@/components/LabelWithHelp";

// Steps 2 and 3 of the client-authentication wizard for Auth0. No certificate is
// involved: Auth0 stores the public key as an application credential and
// identifies it by a `kid` it derives itself (a JWK thumbprint), so the key ID
// has to be read back from Auth0 rather than computed here.

type Props = {
  publicKeyPem: string;
  clientAssertionKid: string;
  setClientAssertionKid: (v: string) => void;
  setKidConfirmed: (v: boolean) => void;
};

const labelledRow = {
  display: "grid",
  gridTemplateColumns: "minmax(15rem, 18rem) 1fr",
  alignItems: "center",
  columnGap: "0.75rem",
} as const;

export default function PrivateKeyCredential(props: Readonly<Props>) {
  const {
    publicKeyPem,
    clientAssertionKid,
    setClientAssertionKid,
    setKidConfirmed,
  } = props;

  const t = useTranslations("StepAuthentication");

  const handleConfirmKid = () => {
    if (!clientAssertionKid) {
      alert(t("errors.missingKid"));
      return;
    }
    setKidConfirmed(true);
  };

  return (
    <>
      {/* Step 2: Register the public key with Auth0 */}
      <div className="col-12">
        <div className="flex gap-2 align-items-center mt-5 mb-2">
          <h5 className="m-0" style={{ fontSize: "1rem", fontWeight: 600 }}>
            {t("steps.auth0RegisterPublicKey.title")}
          </h5>
          {publicKeyPem && (
            <span
              className="pi pi-check-circle"
              style={{ color: "var(--green-500)" }}
              aria-label={t("aria.keyPairGenerated")}
            />
          )}
        </div>
        <p className="text-sm mb-0 text-600">
          {t("steps.auth0RegisterPublicKey.description")}
        </p>
      </div>

      {/* Step 3: Key ID from the Auth0 credential */}
      <div className="col-12">
        <div className="flex gap-2 align-items-center mt-5 mb-2">
          <h5 className="m-0" style={{ fontSize: "1rem", fontWeight: 600 }}>
            {t("steps.auth0ConfigureKid.title")}
          </h5>
          {clientAssertionKid && (
            <span
              className="pi pi-check-circle"
              style={{ color: "var(--green-500)" }}
              aria-label={t("aria.kidConfigured")}
            />
          )}
        </div>
        <p className="text-sm mb-3 text-600">
          {t("steps.auth0ConfigureKid.description")}
        </p>
        <Button
          label={t("buttons.confirmKid")}
          icon="pi pi-check"
          onClick={handleConfirmKid}
          disabled={!clientAssertionKid}
          className="mb-3"
        />
      </div>
      <div className="col-12">
        <div style={labelledRow}>
          <div style={{ textAlign: "left" }}>
            <LabelWithHelp
              id="clientAssertionKid"
              text={t("labels.clientAssertionKid")}
              help={t("help.auth0ClientAssertionKid")}
            />
          </div>
          <div>
            <InputText
              id="clientAssertionKid"
              value={clientAssertionKid}
              onChange={(e) => {
                setClientAssertionKid(e.target.value);
                setKidConfirmed(false);
              }}
              placeholder={t("placeholders.auth0ClientAssertionKid")}
              style={{ fontFamily: "monospace", width: "100%" }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
