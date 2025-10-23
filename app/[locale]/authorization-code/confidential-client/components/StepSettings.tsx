"use client";
import {InputText} from 'primereact/inputtext';
import {InputTextarea} from 'primereact/inputtextarea';
import {Dropdown} from 'primereact/dropdown';
import {InputSwitch} from 'primereact/inputswitch';
import {useTranslations} from 'next-intl';
import LabelWithHelp from '@/components/LabelWithHelp';

export type ClientAuthMethod = 'secret' | 'certificate';

type Props = {
  tenantId: string;
  setTenantId: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  redirectUri: string;
  scopes: string;
  setScopes: (v: string) => void;
  pkceEnabled: boolean;
  setPkceEnabled: (v: boolean) => void;
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
  resolvedAuthEndpoint: string;
  resolvedTokenEndpoint: string;
  tenantIdValid: boolean;
  clientIdValid: boolean;
  redirectUriValid: boolean;
  safeT: (key: string) => string;
};

export default function StepSettings(props: Props) {
  const t = useTranslations('AuthorizationCode.PublicClient');
  const {
    tenantId, setTenantId,
    clientId, setClientId,
    redirectUri,
    scopes, setScopes,
    pkceEnabled, setPkceEnabled,
    clientAuthMethod, setClientAuthMethod,
    clientSecret, setClientSecret,
    privateKeyPem, setPrivateKeyPem,
    certificatePem, setCertificatePem,
    clientAssertionKid, setClientAssertionKid,
    resolvedAuthEndpoint, resolvedTokenEndpoint,
    tenantIdValid, clientIdValid, redirectUriValid,
    safeT
  } = props;

  const methodOptions = [
    { label: 'Client secret', value: 'secret' },
    { label: 'Certificate (private_key_jwt)', value: 'certificate' }
  ];

  const maybeT = (key: string, fallback?: string) => {
    try { const v = t(key as any); if (!v || typeof v !== 'string' || v.indexOf(key) !== -1) return fallback ?? ''; return v; } catch { return fallback ?? ''; }
  };

  return (
    <section>
      <h3 className="mt-0 mb-3">{t('sections.settings.title')}</h3>
      <p className="mb-3">{t('sections.settings.description')}</p>

      {/* Editable settings */}
      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <h4 className="mt-0 mb-2">{maybeT('sections.settings.userProvidedTitle', 'User-provided settings')}</h4>
        <p className="mb-3 text-sm opacity-75">{maybeT('sections.settings.userProvidedDescription', 'These fields are configurable by you and are used to build the authorization request.')}</p>

        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12 md:col-6">
            <LabelWithHelp id="tenantId" text={t('labels.tenantId')} help={t('help.tenantId')} />
            <InputText id="tenantId" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder={t('placeholders.tenantId')} className={!tenantIdValid ? 'p-invalid' : ''} />
            {!tenantIdValid && (<small className="p-error block mt-1">{t('errors.tenantIdInvalid')}</small>)}
          </div>

          <div className="col-12 md:col-6">
            <LabelWithHelp id="clientId" text={t('labels.clientId')} help={t('help.clientId')} />
            <InputText id="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder={t('placeholders.clientId')} className={!clientIdValid ? 'p-invalid' : ''} />
            {!clientIdValid && (<small className="p-error block mt-1">{clientId ? t('errors.clientIdInvalid') : t('errors.clientIdRequired')}</small>)}
          </div>

          <div className="col-12 md:col-6">
            <LabelWithHelp id="scopes" text={t('labels.scopes')} help={t('help.scopes')} />
            <InputText id="scopes" value={scopes} onChange={(e) => setScopes(e.target.value)} placeholder={t('placeholders.scopes')} />
          </div>

          <div className="col-12 md:col-6">
            <LabelWithHelp id="pkceEnabled" text="Use PKCE" help="PKCE is optional for confidential clients but recommended." />
            <div className="flex align-items-center gap-2">
              <InputSwitch inputId="pkceEnabled" checked={pkceEnabled} onChange={(e) => setPkceEnabled(!!e.value)} />
              <label htmlFor="pkceEnabled" className="m-0">{pkceEnabled ? 'Enabled' : 'Disabled'}</label>
            </div>
          </div>

          <div className="col-12 md:col-6">
            <LabelWithHelp id="clientAuthMethod" text="Client authentication" help="Choose how the client authenticates to the token endpoint when exchanging the code." />
            <Dropdown id="clientAuthMethod" value={clientAuthMethod} onChange={(e) => setClientAuthMethod(e.value as ClientAuthMethod)} options={methodOptions} placeholder={t('placeholders.selectMethod')} />
          </div>
        </div>

        {clientAuthMethod === 'secret' && (
          <div className="grid formgrid p-fluid gap-3 mt-2">
            <div className="col-12 md:col-8">
              <LabelWithHelp id="clientSecret" text="Client secret" help="Your confidential client secret. For demo purposes this value stays in memory only (not persisted)." />
              <InputText id="clientSecret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Enter client secret" />
            </div>
          </div>
        )}

        {clientAuthMethod === 'certificate' && (
          <div className="grid formgrid p-fluid gap-3 mt-2">
            <div className="col-12">
              <LabelWithHelp id="privateKeyPem" text="Private key (PKCS#8 PEM)" help="PEM-encoded RSA private key used to sign the client_assertion (RS256). Not persisted." />
              <InputTextarea id="privateKeyPem" rows={6} autoResize value={privateKeyPem} onChange={(e) => setPrivateKeyPem(e.target.value)} placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'} />
            </div>
            <div className="col-12 md:col-6">
              <LabelWithHelp id="clientAssertionKid" text="kid (optional)" help="Optional key ID to include in the client_assertion header; should match the certificate uploaded in Entra ID." />
              <InputText id="clientAssertionKid" value={clientAssertionKid} onChange={(e) => setClientAssertionKid(e.target.value)} placeholder="kid or thumbprint" />
            </div>
            <div className="col-12">
              <LabelWithHelp id="certificatePem" text="Certificate (PEM, optional)" help="Optional PEM certificate. Not required to sign; provided for reference." />
              <InputTextarea id="certificatePem" rows={4} autoResize value={certificatePem} onChange={(e) => setCertificatePem(e.target.value)} placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'} />
            </div>
          </div>
        )}
      </div>

      {/* Resolved (read-only) values */}
      <div className="surface-0 py-3 px-0 border-round">
        <h4 className="mt-0 mb-2">{maybeT('sections.settings.resolvedTitle', 'Resolved (read-only) values')}</h4>
        <p className="mb-3 text-sm opacity-75">{maybeT('sections.settings.resolvedDescription', 'These values are derived from the tenant and other inputs. They are shown for reference and cannot be changed here.')}</p>
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12 md:col-6">
            <LabelWithHelp id="authEndpoint" text={t('labels.authEndpoint')} help={safeT('help.authEndpoint')} />
            <InputText id="authEndpoint" value={resolvedAuthEndpoint} readOnly />
          </div>
          <div className="col-12 md:col-6">
            <LabelWithHelp id="tokenEndpoint" text={t('labels.tokenEndpoint')} help={safeT('help.tokenEndpoint')} />
            <InputText id="tokenEndpoint" value={resolvedTokenEndpoint} readOnly />
          </div>
          <div className="col-12 md:col-6">
            <LabelWithHelp id="redirectUri" text={t('labels.redirectUri')} help={t('help.redirectUri')} />
            <InputText id="redirectUri" value={redirectUri} readOnly className={!redirectUriValid ? 'p-invalid' : ''} />
            {!redirectUriValid && (<small className="p-error block mt-1">{t('errors.redirectUriInvalid')}</small>)}
          </div>
        </div>
      </div>
    </section>
  );
}
