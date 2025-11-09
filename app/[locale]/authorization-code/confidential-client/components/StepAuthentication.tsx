"use client";
import { useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { useTranslations } from 'next-intl';
import LabelWithHelp from '@/components/LabelWithHelp';
import type { ClientAuthMethod } from './StepSettings';
import { generateRsaKeyPair, createSelfSignedCertificate } from '@/utils/certificate';
import { buildClientAssertionClaims, buildClientAssertion } from '@/utils/jwtSign';
import { decodeJwt } from '@/utils/jwtDecode';

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
  const t = useTranslations('AuthorizationCode.PublicClient');
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

  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [generatingCert, setGeneratingCert] = useState(false);
  const [generatingAssertion, setGeneratingAssertion] = useState(false);

  const methodOptions = [
    { label: 'Client secret', value: 'secret' },
    { label: 'Certificate (private_key_jwt)', value: 'certificate' }
  ];

  const handleGenerateKeyPair = async () => {
    setGeneratingKeys(true);
    try {
      const { privateKeyPem: privKey, publicKeyPem: pubKey } = await generateRsaKeyPair();
      setPrivateKeyPem(privKey);
      setPublicKeyPem(pubKey);
    } catch (e: any) {
      alert(`Error generating key pair: ${String(e)}`);
    } finally {
      setGeneratingKeys(false);
    }
  };

  const handleGenerateCertificate = async () => {
    if (!publicKeyPem || !privateKeyPem) {
      alert('Please generate a key pair first.');
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
    } catch (e: any) {
      alert(`Error generating certificate: ${String(e)}`);
    } finally {
      setGeneratingCert(false);
    }
  };

  const handlePreviewClaims = () => {
    if (!clientId || !tokenEndpoint) {
      alert('Please configure client ID and token endpoint first.');
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
      alert('Please generate a key pair and configure settings first.');
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
      setDecodedAssertion(`Header:\n${decoded.header}\n\nPayload:\n${decoded.payload}`);
    } catch (e: any) {
      alert(`Error generating assertion: ${String(e)}`);
    } finally {
      setGeneratingAssertion(false);
    }
  };

  return (
    <section>
      <p className="mb-3">Choose how the client will authenticate to the token endpoint when exchanging the authorization code.</p>
      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12 md:col-12">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.75rem' }}>
              <div style={{ textAlign: 'left' }}>
                <LabelWithHelp id="clientAuthMethod" text="Client authentication" help="Choose how the client authenticates to the token endpoint when exchanging the code." />
              </div>
              <div>
                <Dropdown id="clientAuthMethod" value={clientAuthMethod} onChange={(e) => setClientAuthMethod(e.value as ClientAuthMethod)} options={methodOptions} placeholder={t('placeholders.selectMethod')} style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        </div>

        {clientAuthMethod === 'secret' && (
          <div className="grid formgrid p-fluid gap-3 mt-2">
            <div className="col-12 md:col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="clientSecret" text="Client secret" help="Your confidential client secret. For demo purposes this value stays in memory only (not persisted)." />
                </div>
                <div>
                  <Password id="clientSecret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Enter client secret" style={{ fontSize: '1.15rem', width: '100%' }} toggleMask feedback={false} />
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
                  Step 1: Generate RSA Key Pair
                </h5>
                {privateKeyPem && (
                  <span className="pi pi-check-circle" style={{ color: 'var(--green-500)' }} aria-label="key pair generated" />
                )}
              </div>
              <p className="text-sm mb-3 text-600">
                Generate a 2048-bit RSA key pair for signing the client assertion JWT.
              </p>
              <Button
                label="Generate Key Pair"
                icon="pi pi-key"
                onClick={handleGenerateKeyPair}
                loading={generatingKeys}
                className="mb-3"
              />
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'start', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="privateKeyPem" text="Private Key (PKCS#8 PEM)" help="Keep this secure! This private key is used to sign the client assertion JWT." />
                </div>
                <div>
                  <InputTextarea
                    id="privateKeyPem"
                    rows={5}
                    autoResize={false}
                    value={privateKeyPem}
                    onChange={(e) => setPrivateKeyPem(e.target.value)}
                    placeholder="Click 'Generate Key Pair' to create a private key"
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'start', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="publicKeyPem" text="Public Key (SPKI PEM)" help="The public key corresponding to your private key." />
                </div>
                <div>
                  <InputTextarea
                    id="publicKeyPem"
                    rows={5}
                    autoResize={false}
                    value={publicKeyPem}
                    readOnly
                    placeholder="Generated automatically with the private key"
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', background: '#f8f9fa', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Generate Self-Signed Certificate */}
            <div className="col-12">
              <div className="flex gap-2 align-items-center mt-5 mb-2">
                <h5 className="m-0" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  Step 2: Create Self-Signed Certificate
                </h5>
                {certificatePem && (
                  <span className="pi pi-check-circle" style={{ color: 'var(--green-500)' }} aria-label="certificate generated" />
                )}
              </div>
              <p className="text-sm mb-3 text-600">
                Create a self-signed X.509 certificate to upload to Microsoft Entra ID. The certificate thumbprint can be used as the kid.
              </p>
              <Button
                label="Generate Certificate"
                icon="pi pi-file"
                onClick={handleGenerateCertificate}
                loading={generatingCert}
                disabled={!privateKeyPem || !publicKeyPem}
                className="mb-3"
              />
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'start', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="certificatePem" text="Certificate (PEM)" help="Upload this certificate to Entra ID under App Registration → Certificates & secrets." />
                </div>
                <div>
                  <InputTextarea
                    id="certificatePem"
                    rows={5}
                    autoResize={false}
                    value={certificatePem}
                    onChange={(e) => setCertificatePem(e.target.value)}
                    placeholder="Click 'Generate Certificate' to create a self-signed certificate"
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="thumbprintSha1" text="Thumbprint (SHA-1)" help="Use this as the Key ID (kid). This matches what you see in Entra ID portal." />
                </div>
                <div>
                  <InputText
                    id="thumbprintSha1"
                    value={thumbprintSha1}
                    readOnly
                    placeholder="Generated automatically with the certificate"
                    style={{ fontFamily: 'monospace', fontSize: '0.9rem', width: '100%', background: '#f8f9fa' }}
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Configure kid */}
            <div className="col-12">
              <div className="flex gap-2 align-items-center mt-5 mb-2">
                <h5 className="m-0" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  Step 3: Key ID (kid) - Auto-populated
                </h5>
                {certificatePem && (
                  <span className="pi pi-check-circle" style={{ color: 'var(--green-500)' }} aria-label="kid configured" />
                )}
              </div>
              <p className="text-sm mb-3 text-600">
                The certificate thumbprint (SHA-1) is automatically used as the Key ID and matches what you see in Entra ID portal.
              </p>
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="clientAssertionKid" text="Key ID (kid)" help="This should match the 'Thumbprint' shown in Entra ID → App Registration → Certificates & secrets" />
                </div>
                <div>
                  <InputText
                    id="clientAssertionKid"
                    value={clientAssertionKid}
                    onChange={(e) => setClientAssertionKid(e.target.value)}
                    placeholder="Auto-filled when certificate is generated"
                    style={{ fontFamily: 'monospace', width: '100%' }}
                  />
                </div>
              </div>
            </div>

            {/* Step 4: Preview Claims */}
            <div className="col-12">
              <div className="flex gap-2 align-items-center mt-5 mb-2">
                <h5 className="m-0" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  Step 4: Preview Client Assertion Claims
                </h5>
                {assertionClaims && (
                  <span className="pi pi-check-circle" style={{ color: 'var(--green-500)' }} aria-label="claims previewed" />
                )}
              </div>
              <p className="text-sm mb-3 text-600">
                Preview the JWT claims that will be used in the client_assertion parameter.
              </p>
              <Button
                label="Preview Claims"
                icon="pi pi-eye"
                onClick={handlePreviewClaims}
                disabled={!clientId || !tokenEndpoint}
                className="mb-3"
              />
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'start', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="assertionClaims" text="JWT Claims (Preview)" help="Preview of the JWT claims that will be used in the client_assertion parameter." />
                </div>
                <div>
                  <InputTextarea
                    id="assertionClaims"
                    rows={5}
                    autoResize={false}
                    value={assertionClaims}
                    readOnly
                    placeholder="Click 'Preview Claims' to see the JWT claims"
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', background: '#f8f9fa', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            {/* Step 5: Test Generate Assertion */}
            <div className="col-12">
              <div className="flex gap-2 align-items-center mt-5 mb-2">
                <h5 className="m-0" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  Step 5: Test Generate Signed Assertion
                </h5>
                {testAssertion && (
                  <span className="pi pi-check-circle" style={{ color: 'var(--green-500)' }} aria-label="test assertion generated" />
                )}
              </div>
              <p className="text-sm mb-3 text-600">
                Generate a test client_assertion JWT to verify it&apos;s working. The actual assertion will be created when calling the token endpoint.
              </p>
              <Button
                label="Generate Test Assertion"
                icon="pi pi-shield"
                onClick={handleGenerateTestAssertion}
                loading={generatingAssertion}
                disabled={!privateKeyPem || !clientId || !tokenEndpoint}
                className="mb-3"
              />
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'start', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="testAssertion" text="Signed JWT (Test)" help="A test client_assertion JWT generated with your private key." />
                </div>
                <div>
                  <InputTextarea
                    id="testAssertion"
                    rows={5}
                    autoResize={false}
                    value={testAssertion}
                    readOnly
                    placeholder="Click 'Generate Test Assertion' to create a test JWT"
                    style={{ fontFamily: 'monospace', fontSize: '0.75rem', width: '100%', background: '#f8f9fa', wordBreak: 'break-all', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>
            <div className="col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'start', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="decodedAssertion" text="Decoded JWT (Verification)" help="The decoded header and payload of the test JWT for verification purposes." />
                </div>
                <div>
                  <InputTextarea
                    id="decodedAssertion"
                    rows={5}
                    autoResize={false}
                    value={decodedAssertion}
                    readOnly
                    placeholder="Generated automatically when test assertion is created"
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', background: '#f8f9fa', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            <div className="col-12">
              <div className="p-0 surface-100 border-round">
                <p className="text-sm mb-0 text-600">
                  <strong>Note:</strong> When you click &quot;Exchange Code for Tokens&quot; in the next step, a fresh client_assertion will be automatically generated and sent to the token endpoint. The private key stays secure and never leaves your browser.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
