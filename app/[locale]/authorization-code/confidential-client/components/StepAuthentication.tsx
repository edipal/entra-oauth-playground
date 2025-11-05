"use client";
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { InputTextarea } from 'primereact/inputtextarea';
import { useTranslations } from 'next-intl';
import LabelWithHelp from '@/components/LabelWithHelp';
import type { ClientAuthMethod } from './StepSettings';

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
};

export default function StepAuthentication(props: Props) {
  const t = useTranslations('AuthorizationCode.PublicClient');
  const {
    clientAuthMethod, setClientAuthMethod,
    clientSecret, setClientSecret,
    privateKeyPem, setPrivateKeyPem,
    certificatePem, setCertificatePem,
    clientAssertionKid, setClientAssertionKid
  } = props;

  const methodOptions = [
    { label: 'Client secret', value: 'secret' },
    { label: 'Certificate (private_key_jwt)', value: 'certificate' }
  ];

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
          <div className="grid formgrid p-fluid gap-3 mt-2">
            <div className="col-12 md:col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left', alignSelf: 'start' }}>
                  <LabelWithHelp id="privateKeyPem" text="Private key (PKCS#8 PEM)" help="PEM-encoded RSA private key used to sign the client_assertion (RS256). Not persisted." />
                </div>
                <div>
                  <InputTextarea id="privateKeyPem" rows={6} autoResize value={privateKeyPem} onChange={(e) => setPrivateKeyPem(e.target.value)} placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'} style={{ fontFamily: 'monospace', width: '100%' }} />
                </div>
              </div>
            </div>
            <div className="col-12 md:col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <LabelWithHelp id="clientAssertionKid" text="kid (optional)" help="Optional key ID to include in the client_assertion header; should match the certificate uploaded in Entra ID." />
                </div>
                <div>
                  <InputText id="clientAssertionKid" value={clientAssertionKid} onChange={(e) => setClientAssertionKid(e.target.value)} placeholder="kid or thumbprint" style={{ fontSize: '1.15rem', width: '100%' }} />
                </div>
              </div>
            </div>
            <div className="col-12 md:col-12">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.75rem' }}>
                <div style={{ textAlign: 'left', alignSelf: 'start' }}>
                  <LabelWithHelp id="certificatePem" text="Certificate (PEM, optional)" help="Optional PEM certificate. Not required to sign; provided for reference." />
                </div>
                <div>
                  <InputTextarea id="certificatePem" rows={4} autoResize value={certificatePem} onChange={(e) => setCertificatePem(e.target.value)} placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'} style={{ fontFamily: 'monospace', width: '100%' }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
