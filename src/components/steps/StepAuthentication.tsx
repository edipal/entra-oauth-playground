"use client";
import { useId, useState } from "react";
import Image from "next/image";
import { Dropdown } from "primereact/dropdown";
import { Password } from "primereact/password";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { useTranslations } from "next-intl";
import LabelWithHelp from "@/components/LabelWithHelp";
import type { ClientAuthMethod } from "@/types/client-auth";
import CertificateCredential from "@/components/steps/entra/CertificateCredential";
import Auth0PrivateKeyCredential from "@/components/steps/auth0/PrivateKeyCredential";
import { generateRsaKeyPair } from "@/lib/certificate";
import {
  buildClientAssertionClaims,
  buildClientAssertion,
} from "@/lib/jwtSign";
import { decodeJwt } from "@/lib/jwtDecode";
import type { IdentityProviderId } from "@/lib/identityProvider";

type Props = {
  providerId: IdentityProviderId;
  clientAuthMethod: ClientAuthMethod;
  setClientAuthMethod: (v: ClientAuthMethod) => void;
  clientSecret: string;
  setClientSecret: (v: string) => void;
  privateKeyPem: string;
  setPrivateKeyPem: (v: string) => void;
  certificatePem: string;
  setCertificatePem: (v: string) => void;
  clientAssertionKid: string;
  setClientAssertionKid: (v: string) => void;
  setClientAssertionX5t: (v: string) => void;
  publicKeyPem: string;
  setPublicKeyPem: (v: string) => void;
  thumbprintSha1: string;
  setThumbprintSha1: (v: string) => void;
  setThumbprintSha256: (v: string) => void;
  thumbprintSha1Base64Url: string;
  setThumbprintSha1Base64Url: (v: string) => void;
  assertionClaims: string;
  setAssertionClaims: (v: string) => void;
  testAssertion: string;
  setTestAssertion: (v: string) => void;
  decodedAssertion: string;
  setDecodedAssertion: (v: string) => void;
  clientId: string;
  /** Provider-specific `aud` for the assertion — see getClientAssertionAudience. */
  assertionAudience: string;
};

export default function StepAuthentication(props: Readonly<Props>) {
  const {
    providerId,
    clientAuthMethod,
    setClientAuthMethod,
    clientSecret,
    setClientSecret,
    privateKeyPem,
    setPrivateKeyPem,
    certificatePem,
    setCertificatePem,
    clientAssertionKid,
    setClientAssertionKid,
    setClientAssertionX5t,
    publicKeyPem,
    setPublicKeyPem,
    thumbprintSha1,
    setThumbprintSha1,
    setThumbprintSha256,
    thumbprintSha1Base64Url,
    setThumbprintSha1Base64Url,
    assertionClaims,
    setAssertionClaims,
    testAssertion,
    setTestAssertion,
    decodedAssertion,
    setDecodedAssertion,
    clientId,
    assertionAudience,
  } = props;

  const t = useTranslations("StepAuthentication");

  const isAuth0 = providerId === "auth0";
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [generatingAssertion, setGeneratingAssertion] = useState(false);
  const [kidConfirmed, setKidConfirmed] = useState(false);
  const noteIconId = useId();

  const methodOptions = [
    { label: t("methodOptions.secret"), value: "secret" },
    {
      label: isAuth0
        ? t("methodOptions.auth0PrivateKey")
        : t("methodOptions.certificate"),
      value: "certificate",
    },
  ];

  const handleGenerateKeyPair = async () => {
    setGeneratingKeys(true);
    try {
      const { privateKeyPem: privKey, publicKeyPem: pubKey } =
        await generateRsaKeyPair();
      setPrivateKeyPem(privKey);
      setPublicKeyPem(pubKey);
    } catch (e: any) {
      alert(t("errors.generateKeyPair", { error: String(e) }));
    } finally {
      setGeneratingKeys(false);
    }
  };

  const handlePreviewClaims = () => {
    if (!clientId || !assertionAudience) {
      alert(t("errors.missingClientConfig"));
      return;
    }
    const claims = buildClientAssertionClaims({
      clientId,
      audience: assertionAudience,
      lifetimeSec: 60,
    });
    setAssertionClaims(JSON.stringify(claims, null, 2));
  };

  const handleGenerateTestAssertion = async () => {
    if (!privateKeyPem || !clientId || !assertionAudience) {
      alert(t("errors.missingKeyOrConfig"));
      return;
    }
    setGeneratingAssertion(true);
    try {
      const assertion = await buildClientAssertion({
        clientId,
        audience: assertionAudience,
        privateKeyPem,
        // Auth0 has no certificate in the picture, so no x5t is ever sent.
        x5t: isAuth0 ? undefined : thumbprintSha1Base64Url || undefined,
        kid: clientAssertionKid || undefined,
        lifetimeSec: 60,
      });
      setTestAssertion(assertion);

      // Decode it for preview
      const decoded = decodeJwt(assertion);
      const headerLabel = t("decoded.headerLabel");
      const payloadLabel = t("decoded.payloadLabel");
      setDecodedAssertion(
        `${headerLabel}\n${decoded.header}\n\n${payloadLabel}\n${decoded.payload}`,
      );
    } catch (e: any) {
      alert(t("errors.generateAssertion", { error: String(e) }));
    } finally {
      setGeneratingAssertion(false);
    }
  };

  return (
    <section>
      <p className="mb-3">{t("description")}</p>
      <div className="grid formgrid p-fluid gap-3 mt-5 mb-5">
        <div className="col-12">
          <div className="p-0  border-round">
            <p className="text-sm mb-0 text-600">
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <Image
                  id={noteIconId}
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FFBB33'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E"
                  alt={t("note.body")}
                  width={16}
                  height={16}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    verticalAlign: "middle",
                    lineHeight: "1",
                  }}
                />
              </span>
              <span style={{ marginLeft: "0.5rem" }}>{t("note.body")}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12 md:col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(15rem, 18rem) 1fr",
                alignItems: "center",
                columnGap: "0.75rem",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="clientAuthMethod"
                  text={t("labels.clientAuthMethod")}
                  help={t("help.clientAuthMethod")}
                />
              </div>
              <div>
                <Dropdown
                  inputId="clientAuthMethod"
                  value={clientAuthMethod}
                  onChange={(e) =>
                    setClientAuthMethod(e.value as ClientAuthMethod)
                  }
                  options={methodOptions}
                  placeholder={t("placeholders.clientAuthMethod")}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>
        </div>

        {clientAuthMethod === "secret" && (
          <div className="grid formgrid p-fluid gap-3 mt-2">
            <div className="col-12 md:col-12">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(15rem, 18rem) 1fr",
                  alignItems: "center",
                  columnGap: "0.75rem",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <LabelWithHelp
                    id="clientSecret"
                    text={t("labels.clientSecret")}
                    help={t("help.clientSecret")}
                  />
                </div>
                <div>
                  <Password
                    inputId="clientSecret"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={t("placeholders.clientSecret")}
                    variant="outlined"
                    className="client-secret-password"
                    toggleMask
                    feedback={false}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {clientAuthMethod === "certificate" && (
          <div className="grid formgrid p-fluid gap-3 mt-7">
            {/* Step 1: Generate Key Pair */}
            <div className="col-12">
              <div className="flex gap-2 align-items-center mt-0 mb-2">
                <h5
                  className="m-0"
                  style={{ fontSize: "1rem", fontWeight: 600 }}
                >
                  {t("steps.generateKeyPair.title")}
                </h5>
                {privateKeyPem && (
                  <span
                    className="pi pi-check-circle"
                    style={{ color: "var(--green-500)" }}
                    aria-label={t("aria.keyPairGenerated")}
                  />
                )}
              </div>
              <p className="text-sm mb-3 text-600">
                {t("steps.generateKeyPair.description")}
              </p>
              <Button
                label={t("buttons.generateKeyPair")}
                icon="pi pi-key"
                onClick={handleGenerateKeyPair}
                loading={generatingKeys}
                className="mb-3"
              />
            </div>
            <div className="col-12">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(15rem, 18rem) 1fr",
                  alignItems: "start",
                  columnGap: "0.75rem",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <LabelWithHelp
                    id="privateKeyPem"
                    text={t("labels.privateKeyPem")}
                    help={t("help.privateKeyPem")}
                  />
                </div>
                <div>
                  <InputTextarea
                    id="privateKeyPem"
                    rows={5}
                    autoResize
                    value={privateKeyPem}
                    onChange={(e) => setPrivateKeyPem(e.target.value)}
                    placeholder={t("placeholders.privateKeyPem")}
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
                  gridTemplateColumns: "minmax(15rem, 18rem) 1fr",
                  alignItems: "start",
                  columnGap: "0.75rem",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <LabelWithHelp
                    id="publicKeyPem"
                    text={t("labels.publicKeyPem")}
                    help={t("help.publicKeyPem")}
                  />
                </div>
                <div>
                  <InputTextarea
                    id="publicKeyPem"
                    rows={5}
                    autoResize
                    value={publicKeyPem}
                    readOnly
                    placeholder={t("placeholders.publicKeyPem")}
                    style={{
                      width: "100%",
                      whiteSpace: "pre-wrap",
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>
            </div>

            {isAuth0 ? (
              <Auth0PrivateKeyCredential
                publicKeyPem={publicKeyPem}
                clientAssertionKid={clientAssertionKid}
                setClientAssertionKid={setClientAssertionKid}
                setKidConfirmed={setKidConfirmed}
              />
            ) : (
              <CertificateCredential
                privateKeyPem={privateKeyPem}
                publicKeyPem={publicKeyPem}
                certificatePem={certificatePem}
                setCertificatePem={setCertificatePem}
                thumbprintSha1={thumbprintSha1}
                setThumbprintSha1={setThumbprintSha1}
                setThumbprintSha256={setThumbprintSha256}
                setThumbprintSha1Base64Url={setThumbprintSha1Base64Url}
                clientAssertionKid={clientAssertionKid}
                setClientAssertionKid={setClientAssertionKid}
                setClientAssertionX5t={setClientAssertionX5t}
                setKidConfirmed={setKidConfirmed}
              />
            )}

            {/* Step 4: Preview Claims */}
            <div className="col-12">
              <div className="flex gap-2 align-items-center mt-5 mb-2">
                <h5
                  className="m-0"
                  style={{ fontSize: "1rem", fontWeight: 600 }}
                >
                  {t("steps.previewClaims.title")}
                </h5>
                {assertionClaims && (
                  <span
                    className="pi pi-check-circle"
                    style={{ color: "var(--green-500)" }}
                    aria-label={t("aria.claimsPreviewed")}
                  />
                )}
              </div>
              <p className="text-sm mb-3 text-600">
                {t("steps.previewClaims.description")}
              </p>
              <Button
                label={t("buttons.previewClaims")}
                icon="pi pi-eye"
                onClick={handlePreviewClaims}
                disabled={!kidConfirmed || !clientId || !assertionAudience}
                className="mb-3"
              />
            </div>
            <div className="col-12">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(15rem, 18rem) 1fr",
                  alignItems: "start",
                  columnGap: "0.75rem",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <LabelWithHelp
                    id="assertionClaims"
                    text={t("labels.assertionClaims")}
                    help={t("help.assertionClaims")}
                  />
                </div>
                <div>
                  <InputTextarea
                    id="assertionClaims"
                    rows={5}
                    autoResize
                    value={assertionClaims}
                    readOnly
                    placeholder={t("placeholders.assertionClaims")}
                    style={{
                      width: "100%",
                      whiteSpace: "pre-wrap",
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Step 5: Test Generate Assertion */}
            <div className="col-12">
              <div className="flex gap-2 align-items-center mt-5 mb-2">
                <h5
                  className="m-0"
                  style={{ fontSize: "1rem", fontWeight: 600 }}
                >
                  {t("steps.testAssertion.title")}
                </h5>
                {testAssertion && (
                  <span
                    className="pi pi-check-circle"
                    style={{ color: "var(--green-500)" }}
                    aria-label={t("aria.testAssertionGenerated")}
                  />
                )}
              </div>
              <p className="text-sm mb-3 text-600">
                {t("steps.testAssertion.description")}
              </p>
              <Button
                label={t("buttons.generateTestAssertion")}
                icon="pi pi-shield"
                onClick={handleGenerateTestAssertion}
                loading={generatingAssertion}
                disabled={
                  !assertionClaims ||
                  !privateKeyPem ||
                  !clientId ||
                  !assertionAudience
                }
                className="mb-3"
              />
            </div>
            <div className="col-12">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(15rem, 18rem) 1fr",
                  alignItems: "start",
                  columnGap: "0.75rem",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <LabelWithHelp
                    id="testAssertion"
                    text={t("labels.testAssertion")}
                    help={t("help.testAssertion")}
                  />
                </div>
                <div>
                  <InputTextarea
                    id="testAssertion"
                    rows={5}
                    autoResize
                    value={testAssertion}
                    readOnly
                    placeholder={t("placeholders.testAssertion")}
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
                  gridTemplateColumns: "minmax(15rem, 18rem) 1fr",
                  alignItems: "start",
                  columnGap: "0.75rem",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <LabelWithHelp
                    id="decodedAssertion"
                    text={t("labels.decodedAssertion")}
                    help={t("help.decodedAssertion")}
                  />
                </div>
                <div>
                  <InputTextarea
                    id="decodedAssertion"
                    rows={5}
                    autoResize
                    value={decodedAssertion}
                    readOnly
                    placeholder={t("placeholders.decodedAssertion")}
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
        )}
      </div>
    </section>
  );
}
