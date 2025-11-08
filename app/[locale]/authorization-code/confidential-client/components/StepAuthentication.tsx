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
    clientId,
    tokenEndpoint
  } = props;

  const [publicKeyPem, setPublicKeyPem] = useState('');
  const [thumbprintSha1, setThumbprintSha1] = useState('');
  const [thumbprintSha256, setThumbprintSha256] = useState('');
  const [thumbprintSha1Base64Url, setThumbprintSha1Base64Url] = useState('');
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [generatingCert, setGeneratingCert] = useState(false);
  const [assertionClaims, setAssertionClaims] = useState('');
  const [testAssertion, setTestAssertion] = useState('');
  const [decodedAssertion, setDecodedAssertion] = useState('');
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
          <div className="mt-3">
            {/* Step 1: Generate Key Pair */}
            <div className="mb-4 p-3 surface-50 border-round">
              <h5 className="mt-0 mb-2" style={{ fontSize: '1rem', fontWeight: 600 }}>
                Step 1: Generate RSA Key Pair
              </h5>
              <p className="text-sm mb-3 text-600">
                Generate a 2048-bit RSA key pair for signing the client assertion JWT.
              </p>
              <Button
                label="Generate Key Pair"
                icon="pi pi-key"
                onClick={handleGenerateKeyPair}
                loading={generatingKeys}
                className="mb-3"
                severity="success"
              />
              {privateKeyPem && (
                <div className="grid formgrid p-fluid gap-3">
                  <div className="col-12">
                    <label htmlFor="privateKeyPem" className="block mb-2 font-semibold text-sm">
                      Private Key (PKCS#8 PEM) - Keep this secure!
                    </label>
                    <InputTextarea
                      id="privateKeyPem"
                      rows={6}
                      autoResize
                      value={privateKeyPem}
                      onChange={(e) => setPrivateKeyPem(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%' }}
                    />
                  </div>
                  <div className="col-12">
                    <label htmlFor="publicKeyPem" className="block mb-2 font-semibold text-sm">
                      Public Key (SPKI PEM)
                    </label>
                    <InputTextarea
                      id="publicKeyPem"
                      rows={4}
                      autoResize
                      value={publicKeyPem}
                      readOnly
                      style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', background: '#f8f9fa' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Generate Self-Signed Certificate */}
            <div className="mb-4 p-3 surface-50 border-round">
              <h5 className="mt-0 mb-2" style={{ fontSize: '1rem', fontWeight: 600 }}>
                Step 2: Create Self-Signed Certificate
              </h5>
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
                severity="info"
              />
              {certificatePem && (
                <div className="grid formgrid p-fluid gap-3">
                  <div className="col-12">
                    <label htmlFor="certificatePem" className="block mb-2 font-semibold text-sm">
                      Certificate (PEM) - Upload this to Entra ID
                    </label>
                    <InputTextarea
                      id="certificatePem"
                      rows={5}
                      autoResize
                      value={certificatePem}
                      onChange={(e) => setCertificatePem(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%' }}
                    />
                  </div>
                  {thumbprintSha1 && (
                    <div className="col-12">
                      <label className="block mb-2 font-semibold text-sm">
                        Thumbprint (SHA-1) - Use as kid
                      </label>
                      <div className="p-2 surface-100 border-round" style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                        {thumbprintSha1}
                      </div>
                    </div>
                  )}
                  {thumbprintSha256 && (
                    <div className="col-12">
                      <label className="block mb-2 font-semibold text-sm">
                        Thumbprint (SHA-256)
                      </label>
                      <div className="p-2 surface-100 border-round" style={{ fontFamily: 'monospace', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                        {thumbprintSha256}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Configure kid */}
            <div className="mb-4 p-3 surface-50 border-round">
              <h5 className="mt-0 mb-2" style={{ fontSize: '1rem', fontWeight: 600 }}>
                Step 3: Key ID (kid) - Auto-populated
              </h5>
              <p className="text-sm mb-3 text-600">
                The certificate thumbprint (SHA-1) is automatically used as the Key ID and matches what you see in Entra ID portal.
              </p>
              <div className="grid formgrid p-fluid gap-3">
                <div className="col-12">
                  <label htmlFor="clientAssertionKid" className="block mb-2 font-semibold text-sm">
                    Key ID (kid)
                  </label>
                  <InputText
                    id="clientAssertionKid"
                    value={clientAssertionKid}
                    onChange={(e) => setClientAssertionKid(e.target.value)}
                    placeholder="Auto-filled when certificate is generated"
                    style={{ fontFamily: 'monospace', width: '100%' }}
                  />
                  <small className="text-500 block mt-2">
                    💡 Tip: This should match the &quot;Thumbprint&quot; shown in Entra ID → App Registration → Certificates &amp; secrets
                  </small>
                </div>
              </div>
            </div>

            {/* Step 4: Preview Claims */}
            <div className="mb-4 p-3 surface-50 border-round">
              <h5 className="mt-0 mb-2" style={{ fontSize: '1rem', fontWeight: 600 }}>
                Step 4: Preview Client Assertion Claims
              </h5>
              <p className="text-sm mb-3 text-600">
                Preview the JWT claims that will be used in the client_assertion parameter.
              </p>
              <Button
                label="Preview Claims"
                icon="pi pi-eye"
                onClick={handlePreviewClaims}
                disabled={!clientId || !tokenEndpoint}
                className="mb-3"
                severity="secondary"
              />
              {assertionClaims && (
                <div className="col-12">
                  <label className="block mb-2 font-semibold text-sm">
                    JWT Claims (Preview)
                  </label>
                  <InputTextarea
                    rows={8}
                    value={assertionClaims}
                    readOnly
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', background: '#f8f9fa' }}
                  />
                </div>
              )}
            </div>

            {/* Step 5: Test Generate Assertion */}
            <div className="mb-4 p-3 surface-50 border-round">
              <h5 className="mt-0 mb-2" style={{ fontSize: '1rem', fontWeight: 600 }}>
                Step 5: Test Generate Signed Assertion
              </h5>
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
                severity="warning"
              />
              {testAssertion && (
                <div className="grid formgrid p-fluid gap-3">
                  <div className="col-12">
                    <label className="block mb-2 font-semibold text-sm">
                      Signed JWT (Test)
                    </label>
                    <InputTextarea
                      rows={3}
                      value={testAssertion}
                      readOnly
                      style={{ fontFamily: 'monospace', fontSize: '0.75rem', width: '100%', background: '#f8f9fa', wordBreak: 'break-all' }}
                    />
                  </div>
                  {decodedAssertion && (
                    <div className="col-12">
                      <label className="block mb-2 font-semibold text-sm">
                        Decoded JWT (Verification)
                      </label>
                      <InputTextarea
                        rows={12}
                        value={decodedAssertion}
                        readOnly
                        style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', background: '#f8f9fa' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-3 surface-100 border-round">
              <p className="text-sm mb-0 text-600">
                <strong>Note:</strong> When you click &quot;Exchange Code for Tokens&quot; in the next step, a fresh client_assertion will be automatically generated and sent to the token endpoint. The private key stays secure and never leaves your browser.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
