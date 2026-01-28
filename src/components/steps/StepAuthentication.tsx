"use client";
import { useId, useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Tooltip } from 'primereact/tooltip';
import { useTranslations } from 'next-intl';
import LabelWithHelp from '@/components/LabelWithHelp';
import type { ClientAuthMethod } from '@/types/client-auth';
import { generateRsaKeyPair, createSelfSignedCertificate } from '@/lib/certificate';
import { buildClientAssertionClaims, buildClientAssertion } from '@/lib/jwtSign';
import { decodeJwt } from '@/lib/jwtDecode';

type Props = {
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
  clientAssertionX5t: string;
  setClientAssertionX5t: (v: string) => void;
  publicKeyPem: string;
  setPublicKeyPem: (v: string) => void;
  thumbprintSha1: string;
  setThumbprintSha1: (v: string) => void;
  thumbprintSha256: string;
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
  tokenEndpoint: string;
};

export default function StepAuthentication(props: Props) {
  const {
    clientAuthMethod, setClientAuthMethod,
    clientSecret, setClientSecret,
    privateKeyPem, setPrivateKeyPem,
    certificatePem, setCertificatePem,
    clientAssertionKid, setClientAssertionKid,
    clientAssertionX5t, setClientAssertionX5t,
    publicKeyPem, setPublicKeyPem,
    thumbprintSha1, setThumbprintSha1,
    thumbprintSha256, setThumbprintSha256,
    thumbprintSha1Base64Url, setThumbprintSha1Base64Url,
    assertionClaims, setAssertionClaims,
    testAssertion, setTestAssertion,
    decodedAssertion, setDecodedAssertion,
    clientId,
    tokenEndpoint
  } = props;

  const t = useTranslations('StepAuthentication');

  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [generatingCert, setGeneratingCert] = useState(false);
  const [generatingAssertion, setGeneratingAssertion] = useState(false);
  const [kidConfirmed, setKidConfirmed] = useState(false);
  const noteIconId = useId();

  const methodOptions = [
    { label: t('methodOptions.secret'), value: 'secret' },
    { label: t('methodOptions.certificate'), value: 'certificate' }
  ];

  const handleGenerateKeyPair = async () => {
    setGeneratingKeys(true);
    try {
      const { privateKeyPem: privKey, publicKeyPem: pubKey } = await generateRsaKeyPair();
      setPrivateKeyPem(privKey);
      setPublicKeyPem(pubKey);
    } catch (e: any) {
      alert(t('errors.generateKeyPair', { error: String(e) }));
    } finally {
      setGeneratingKeys(false);
    }
  };

  const handleGenerateCertificate = async () => {
    if (!publicKeyPem || !privateKeyPem) {
      alert(t('errors.keyPairRequired'));
      return;
    }
    setGeneratingCert(true);
    try {
      // Import private key for signing
      const { importPKCS8 } = await import('jose');
      const privateKey = await importPKCS8(privateKeyPem, 'RS256');

      const result = await createSelfSignedCertificate({
        publicKeyPem,
        privateKey,
        subject: 'CN=OAuth Playground Demo',
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
      alert(t('errors.generateCertificate', { error: String(e) }));
    } finally {
      setGeneratingCert(false);
    }
  };

  const handleConfirmKid = () => {
    if (!clientAssertionKid) {
      alert(t('errors.missingKid'));
      return;
    }
    setKidConfirmed(true);
  };

  const handlePreviewClaims = () => {
    if (!clientId || !tokenEndpoint) {
      alert(t('errors.missingClientConfig'));
      return;
    }
    const claims = buildClientAssertionClaims({
      clientId,
      tokenEndpoint,
      lifetimeSec: 60,
    });
    setAssertionClaims(JSON.stringify(claims, null, 2));
  };

  const handleGenerateTestAssertion = async () => {
    if (!privateKeyPem || !clientId || !tokenEndpoint) {
      alert(t('errors.missingKeyOrConfig'));
      return;
    }
    setGeneratingAssertion(true);
    try {
      const assertion = await buildClientAssertion({
        clientId,
        tokenEndpoint,
        privateKeyPem,
        x5t: thumbprintSha1Base64Url || undefined,
        kid: clientAssertionKid || undefined,
        lifetimeSec: 60,
      });
      setTestAssertion(assertion);

      // Decode it for preview
      const decoded = decodeJwt(assertion);
      const headerLabel = t('decoded.headerLabel');
      const payloadLabel = t('decoded.payloadLabel');
      setDecodedAssertion(`${headerLabel}\n${decoded.header}\n\n${payloadLabel}\n${decoded.payload}`);
    } catch (e: any) {
      alert(t('errors.generateAssertion', { error: String(e) }));
    } finally {
      setGeneratingAssertion(false);
    }
  };

  return (
    <section>
      <p className="mb-3">{t('description')}</p>
      <div className="grid formgrid p-fluid gap-3 mt-5 mb-5">
        <div className="col-12">
          <div className="p-0  border-round">
            <p className="text-sm mb-0 text-600">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <i
                  id={noteIconId}
                  className="pi pi-exclamation-circle"
                  aria-label={t('note.body')}
                  role="img"
                  style={{
                    color: 'var(--yellow-500)',
                    fontSize: '1rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    verticalAlign: 'middle',
                    lineHeight: '1'
                  }}
                />
              </span>
              <span style={{ marginLeft: '0.5rem' }}>{t('note.body')}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12 md:col-12">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(15rem, 18rem) 1fr', alignItems: 'center', columnGap: '0.75rem' }}>
              <div style={{ textAlign: 'left' }}>
                <LabelWithHelp id="clientAuthMethod" text={t('labels.clientAuthMethod')} help={t('help.clientAuthMethod')} />
              </div>
              <div>
                <Dropdown id="clientAuthMethod" value={clientAuthMethod} onChange={(e) => setClientAuthMethod(e.value as ClientAuthMethod)} options={methodOptions} placeholder={t('placeholders.clientAuthMethod')} style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        </div>

        {clientAuthMethod === 'secret' && (
          <div className="grid formgrid p-fluid gap-3 mt-2">
            <div className="col-12 md:col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(15rem, 18rem) 1fr', alignItems: 'center', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="clientSecret" text={t('labels.clientSecret')} help={t('help.clientSecret')} />
                </div>
                <div>
                  <Password id="clientSecret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder={t('placeholders.clientSecret')} style={{ fontSize: '1.15rem', width: '100%' }} toggleMask feedback={false} />
                </div>
              </div>
            </div>
          </div>
        )}

        {clientAuthMethod === 'certificate' && (
          <div className="grid formgrid p-fluid gap-3 mt-7">
            {/* Step 1: Generate Key Pair */}
            <div className="col-12">
              <div className="flex gap-2 align-items-center mt-0 mb-2">
                <h5 className="m-0" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  {t('steps.generateKeyPair.title')}
                </h5>
                {privateKeyPem && (
                  <span className="pi pi-check-circle" style={{ color: 'var(--green-500)' }} aria-label={t('aria.keyPairGenerated')} />
                )}
              </div>
              <p className="text-sm mb-3 text-600">
                {t('steps.generateKeyPair.description')}
              </p>
              <Button
                label={t('buttons.generateKeyPair')}
                icon="pi pi-key"
                onClick={handleGenerateKeyPair}
                loading={generatingKeys}
                className="mb-3"
              />
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(15rem, 18rem) 1fr', alignItems: 'start', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="privateKeyPem" text={t('labels.privateKeyPem')} help={t('help.privateKeyPem')} />
                </div>
                <div>
                  <InputTextarea
                    id="privateKeyPem"
                    rows={5}
                    autoResize
                    value={privateKeyPem}
                    onChange={(e) => setPrivateKeyPem(e.target.value)}
                    placeholder={t('placeholders.privateKeyPem')}
                    style={{ width: '100%', whiteSpace: 'pre-wrap', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(15rem, 18rem) 1fr', alignItems: 'start', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="publicKeyPem" text={t('labels.publicKeyPem')} help={t('help.publicKeyPem')} />
                </div>
                <div>
                  <InputTextarea
                    id="publicKeyPem"
                    rows={5}
                    autoResize
                    value={publicKeyPem}
                    readOnly
                    placeholder={t('placeholders.publicKeyPem')}
                    style={{ width: '100%', whiteSpace: 'pre-wrap', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Generate Self-Signed Certificate */}
            <div className="col-12">
              <div className="flex gap-2 align-items-center mt-5 mb-2">
                <h5 className="m-0" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  {t('steps.generateCertificate.title')}
                </h5>
                {certificatePem && (
                  <span className="pi pi-check-circle" style={{ color: 'var(--green-500)' }} aria-label={t('aria.certificateGenerated')} />
                )}
              </div>
              <p className="text-sm mb-3 text-600">
                {t('steps.generateCertificate.description')}
              </p>
              <Button
                label={t('buttons.generateCertificate')}
                icon="pi pi-file"
                onClick={handleGenerateCertificate}
                loading={generatingCert}
                disabled={!privateKeyPem || !publicKeyPem}
                className="mb-3"
              />
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(15rem, 18rem) 1fr', alignItems: 'start', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="certificatePem" text={t('labels.certificatePem')} help={t('help.certificatePem')} />
                </div>
                <div>
                  <InputTextarea
                    id="certificatePem"
                    rows={5}
                    autoResize
                    value={certificatePem}
                    onChange={(e) => setCertificatePem(e.target.value)}
                    placeholder={t('placeholders.certificatePem')}
                    style={{ width: '100%', whiteSpace: 'pre-wrap', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(15rem, 18rem) 1fr', alignItems: 'center', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="thumbprintSha1" text={t('labels.thumbprintSha1')} help={t('help.thumbprintSha1')} />
                </div>
                <div>
                  <InputText
                    id="thumbprintSha1"
                    value={thumbprintSha1}
                    readOnly
                    placeholder={t('placeholders.thumbprintSha1')}
                    style={{ fontFamily: 'monospace', fontSize: '0.9rem', width: '100%'}}
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Configure kid */}
            <div className="col-12">
              <div className="flex gap-2 align-items-center mt-5 mb-2">
                <h5 className="m-0" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  {t('steps.configureKid.title')}
                </h5>
                {certificatePem && (
                  <span className="pi pi-check-circle" style={{ color: 'var(--green-500)' }} aria-label={t('aria.kidConfigured')} />
                )}
              </div>
              <p className="text-sm mb-3 text-600">
                {t('steps.configureKid.description')}
              </p>
              <Button
                label={t('buttons.confirmKid')}
                icon="pi pi-check"
                onClick={handleConfirmKid}
                disabled={!certificatePem || !clientAssertionKid}
                className="mb-3"
              />
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(15rem, 18rem) 1fr', alignItems: 'center', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="clientAssertionKid" text={t('labels.clientAssertionKid')} help={t('help.clientAssertionKid')} />
                </div>
                <div>
                  <InputText
                    id="clientAssertionKid"
                    value={clientAssertionKid}
                    onChange={(e) => setClientAssertionKid(e.target.value)}
                    placeholder={t('placeholders.clientAssertionKid')}
                    style={{ fontFamily: 'monospace', width: '100%' }}
                  />
                </div>
              </div>
            </div>

            {/* Step 4: Preview Claims */}
            <div className="col-12">
              <div className="flex gap-2 align-items-center mt-5 mb-2">
                <h5 className="m-0" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  {t('steps.previewClaims.title')}
                </h5>
                {assertionClaims && (
                  <span className="pi pi-check-circle" style={{ color: 'var(--green-500)' }} aria-label={t('aria.claimsPreviewed')} />
                )}
              </div>
              <p className="text-sm mb-3 text-600">
                {t('steps.previewClaims.description')}
              </p>
              <Button
                label={t('buttons.previewClaims')}
                icon="pi pi-eye"
                onClick={handlePreviewClaims}
                disabled={!kidConfirmed || !clientId || !tokenEndpoint}
                className="mb-3"
              />
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(15rem, 18rem) 1fr', alignItems: 'start', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="assertionClaims" text={t('labels.assertionClaims')} help={t('help.assertionClaims')} />
                </div>
                <div>
                  <InputTextarea
                    id="assertionClaims"
                    rows={5}
                    autoResize
                    value={assertionClaims}
                    readOnly
                    placeholder={t('placeholders.assertionClaims')}
                    style={{ width: '100%', whiteSpace: 'pre-wrap', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            {/* Step 5: Test Generate Assertion */}
            <div className="col-12">
              <div className="flex gap-2 align-items-center mt-5 mb-2">
                <h5 className="m-0" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  {t('steps.testAssertion.title')}
                </h5>
                {testAssertion && (
                  <span className="pi pi-check-circle" style={{ color: 'var(--green-500)' }} aria-label={t('aria.testAssertionGenerated')} />
                )}
              </div>
              <p className="text-sm mb-3 text-600">
                {t('steps.testAssertion.description')}
              </p>
              <Button
                label={t('buttons.generateTestAssertion')}
                icon="pi pi-shield"
                onClick={handleGenerateTestAssertion}
                loading={generatingAssertion}
                disabled={!assertionClaims || !privateKeyPem || !clientId || !tokenEndpoint}
                className="mb-3"
              />
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(15rem, 18rem) 1fr', alignItems: 'start', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="testAssertion" text={t('labels.testAssertion')} help={t('help.testAssertion')} />
                </div>
                <div>
                  <InputTextarea
                    id="testAssertion"
                    rows={5}
                    autoResize
                    value={testAssertion}
                    readOnly
                    placeholder={t('placeholders.testAssertion')}
                    style={{ width: '100%', whiteSpace: 'pre-wrap', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(15rem, 18rem) 1fr', alignItems: 'start', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="decodedAssertion" text={t('labels.decodedAssertion')} help={t('help.decodedAssertion')} />
                </div>
                <div>
                  <InputTextarea
                    id="decodedAssertion"
                    rows={5}
                    autoResize
                    value={decodedAssertion}
                    readOnly
                    placeholder={t('placeholders.decodedAssertion')}
                    style={{ width: '100%', whiteSpace: 'pre-wrap', resize: 'vertical' }}
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
