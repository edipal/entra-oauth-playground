"use client";
import { useState } from "react";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { useTranslations } from "next-intl";
import LabelWithHelp from "@/components/LabelWithHelp";
import {
  createSelfSignedCertificate,
  computeCertificateThumbprints,
} from "@/lib/certificate";

// Steps 2 and 3 of the client-authentication wizard for Entra: a certificate,
// and the SHA-1 thumbprint that Entra uses as both `kid` and `x5t`.

type Props = {
  privateKeyPem: string;
  publicKeyPem: string;
  certificatePem: string;
  setCertificatePem: (v: string) => void;
  thumbprintSha1: string;
  setThumbprintSha1: (v: string) => void;
  setThumbprintSha256: (v: string) => void;
  setThumbprintSha1Base64Url: (v: string) => void;
  clientAssertionKid: string;
  setClientAssertionKid: (v: string) => void;
  setClientAssertionX5t: (v: string) => void;
  setKidConfirmed: (v: boolean) => void;
};

const labelledRow = {
  display: "grid",
  gridTemplateColumns: "minmax(15rem, 18rem) 1fr",
  columnGap: "0.75rem",
} as const;

export default function CertificateCredential(props: Readonly<Props>) {
  const {
    privateKeyPem,
    publicKeyPem,
    certificatePem,
    setCertificatePem,
    thumbprintSha1,
    setThumbprintSha1,
    setThumbprintSha256,
    setThumbprintSha1Base64Url,
    clientAssertionKid,
    setClientAssertionKid,
    setClientAssertionX5t,
    setKidConfirmed,
  } = props;

  const t = useTranslations("StepAuthentication");
  const [generatingCert, setGeneratingCert] = useState(false);
  const [certificateError, setCertificateError] = useState("");

  /**
   * A certificate can also be pasted in rather than generated here — for example
   * one already uploaded to the app registration. Derive the same values the
   * generate path produces, so the flow can continue either way.
   */
  const handleCertificatePemChange = async (value: string) => {
    setCertificatePem(value);

    const thumbprints = await computeCertificateThumbprints(value).catch(
      () => null,
    );
    if (!thumbprints) {
      setThumbprintSha1("");
      setThumbprintSha256("");
      setThumbprintSha1Base64Url("");
      // `kid` and `x5t` identify the certificate to Entra, so a certificate that
      // could not be read must take them with it. Leaving the previous paste's
      // values behind signed the next assertion against a key the request no
      // longer carried, and Entra reported that as an assertion error.
      setClientAssertionKid("");
      setClientAssertionX5t("");
      setKidConfirmed(false);
      setCertificateError(
        value.trim() ? t("errors.certificateUnreadable") : "",
      );
      return;
    }

    setCertificateError("");
    setThumbprintSha1(thumbprints.thumbprintSha1);
    setThumbprintSha256(thumbprints.thumbprintSha256);
    setThumbprintSha1Base64Url(thumbprints.thumbprintSha1Base64Url);
    setClientAssertionKid(thumbprints.thumbprintSha1);
    setClientAssertionX5t(thumbprints.thumbprintSha1Base64Url);
    setKidConfirmed(false);
  };

  const handleGenerateCertificate = async () => {
    if (!publicKeyPem || !privateKeyPem) {
      alert(t("errors.keyPairRequired"));
      return;
    }
    setGeneratingCert(true);
    try {
      // Import private key for signing
      const { importPKCS8 } = await import("jose");
      const privateKey = await importPKCS8(privateKeyPem, "RS256");

      const result = await createSelfSignedCertificate({
        publicKeyPem,
        privateKey,
        subject: "CN=OAuth Playground Demo",
        validDays: 365,
      });

      setCertificatePem(result.certificatePem);
      setThumbprintSha1(result.thumbprintSha1);
      setThumbprintSha256(result.thumbprintSha256);
      setThumbprintSha1Base64Url(result.thumbprintSha1Base64Url);

      // Automatically set SHA-1 thumbprint as kid (matches Entra ID portal)
      setClientAssertionKid(result.thumbprintSha1);
      // Set the base64url-encoded thumbprint for x5t JWT header
      setClientAssertionX5t(result.thumbprintSha1Base64Url);
      setKidConfirmed(false);
    } catch (e: any) {
      alert(t("errors.generateCertificate", { error: String(e) }));
    } finally {
      setGeneratingCert(false);
    }
  };

  const handleConfirmKid = () => {
    if (!clientAssertionKid) {
      alert(t("errors.missingKid"));
      return;
    }
    setKidConfirmed(true);
  };

  return (
    <>
      {/* Step 2: Generate Self-Signed Certificate */}
      <div className="col-12">
        <div className="flex gap-2 align-items-center mt-5 mb-2">
          <h5 className="m-0" style={{ fontSize: "1rem", fontWeight: 600 }}>
            {t("steps.generateCertificate.title")}
          </h5>
          {certificatePem && (
            <span
              className="pi pi-check-circle"
              style={{ color: "var(--green-500)" }}
              aria-label={t("aria.certificateGenerated")}
            />
          )}
        </div>
        <p className="text-sm mb-3 text-600">
          {t("steps.generateCertificate.description")}
        </p>
        <Button
          label={t("buttons.generateCertificate")}
          icon="pi pi-file"
          onClick={handleGenerateCertificate}
          loading={generatingCert}
          disabled={!privateKeyPem || !publicKeyPem}
          className="mb-3"
        />
      </div>
      <div className="col-12">
        <div style={{ ...labelledRow, alignItems: "start" }}>
          <div style={{ textAlign: "left" }}>
            <LabelWithHelp
              id="certificatePem"
              text={t("labels.certificatePem")}
              help={t("help.certificatePem")}
            />
          </div>
          <div>
            <InputTextarea
              id="certificatePem"
              rows={5}
              autoResize
              value={certificatePem}
              onChange={(e) => handleCertificatePemChange(e.target.value)}
              placeholder={t("placeholders.certificatePem")}
              className={certificateError ? "p-invalid" : undefined}
              aria-invalid={certificateError ? true : undefined}
              aria-describedby={
                certificateError ? "certificatePemError" : undefined
              }
              style={{
                width: "100%",
                whiteSpace: "pre-wrap",
                resize: "vertical",
              }}
            />
            {certificateError && (
              <small id="certificatePemError" className="p-error block mt-1">
                {certificateError}
              </small>
            )}
          </div>
        </div>
      </div>
      <div className="col-12">
        <div style={{ ...labelledRow, alignItems: "center" }}>
          <div style={{ textAlign: "left" }}>
            <LabelWithHelp
              id="thumbprintSha1"
              text={t("labels.thumbprintSha1")}
              help={t("help.thumbprintSha1")}
            />
          </div>
          <div>
            <InputText
              id="thumbprintSha1"
              value={thumbprintSha1}
              readOnly
              placeholder={t("placeholders.thumbprintSha1")}
              style={{
                fontFamily: "monospace",
                fontSize: "0.9rem",
                width: "100%",
              }}
            />
          </div>
        </div>
      </div>

      {/* Step 3: Configure kid */}
      <div className="col-12">
        <div className="flex gap-2 align-items-center mt-5 mb-2">
          <h5 className="m-0" style={{ fontSize: "1rem", fontWeight: 600 }}>
            {t("steps.configureKid.title")}
          </h5>
          {certificatePem && (
            <span
              className="pi pi-check-circle"
              style={{ color: "var(--green-500)" }}
              aria-label={t("aria.kidConfigured")}
            />
          )}
        </div>
        <p className="text-sm mb-3 text-600">
          {t("steps.configureKid.description")}
        </p>
        <Button
          label={t("buttons.confirmKid")}
          icon="pi pi-check"
          onClick={handleConfirmKid}
          disabled={!certificatePem || !clientAssertionKid}
          className="mb-3"
        />
      </div>
      <div className="col-12">
        <div style={{ ...labelledRow, alignItems: "center" }}>
          <div style={{ textAlign: "left" }}>
            <LabelWithHelp
              id="clientAssertionKid"
              text={t("labels.clientAssertionKid")}
              help={t("help.clientAssertionKid")}
            />
          </div>
          <div>
            <InputText
              id="clientAssertionKid"
              value={clientAssertionKid}
              onChange={(e) => setClientAssertionKid(e.target.value)}
              placeholder={t("placeholders.clientAssertionKid")}
              style={{ fontFamily: "monospace", width: "100%" }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
