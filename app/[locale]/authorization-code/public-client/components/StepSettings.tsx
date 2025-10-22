"use client";
import {InputText} from 'primereact/inputtext';
import {useTranslations} from 'next-intl';
import LabelWithHelp from '@/components/LabelWithHelp';

type Props = {
  tenantId: string;
  setTenantId: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  redirectUri: string;
  scopes: string;
  setScopes: (v: string) => void;
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
    resolvedAuthEndpoint, resolvedTokenEndpoint,
    tenantIdValid, clientIdValid, redirectUriValid,
    safeT
  } = props;

  // safe translation helper: if the key is missing return the provided fallback or an empty string
  const maybeT = (key: string, fallback?: string) => {
    try {
      const v = t(key as any);
      if (!v || typeof v !== 'string' || v.indexOf(key) !== -1) return fallback ?? '';
      return v;
    } catch (e) {
      return fallback ?? '';
    }
  };

  return (
    <section>
      <h3 className="mt-0 mb-3">{t('sections.settings.title')}</h3>
      <p className="mb-3">{t('sections.settings.description')}</p>

      {/* Editable settings provided by the user */}
  <div className="mb-4 surface-0 py-3 px-0 border-round">
  <h4 className="mt-0 mb-2">{maybeT('sections.settings.userProvidedTitle', 'User-provided settings')}</h4>
  <p className="mb-3 text-sm opacity-75">{maybeT('sections.settings.userProvidedDescription', 'These fields are configurable by you and are used to build the authorization request.')}</p>
  <div className="mb-3 flex gap-3 align-items-start">
    <span className="mr-2 flex align-items-center justify-content-center" style={{ backgroundColor: 'var(--blue-500)', color: 'white', width: '1.25rem', height: '1.25rem', borderRadius: '999px', fontSize: '0.9rem', marginTop: '0.05rem' }} aria-hidden="true">i</span>
    <p className="mb-3 text-sm opacity-75" style={{ margin: 0 }}>{maybeT('sections.settings.localStorageNotice', "These values will be saved in your browser's local storage for convenience.")}</p>
  </div>

        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12 md:col-6">
            <LabelWithHelp id="tenantId" text={t('labels.tenantId')} help={t('help.tenantId')} />
            <InputText id="tenantId" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder={t('placeholders.tenantId')} className={!tenantIdValid ? 'p-invalid' : ''} />
            {!tenantIdValid && (
              <small className="p-error block mt-1">{t('errors.tenantIdInvalid')}</small>
            )}
          </div>

          <div className="col-12 md:col-6">
            <LabelWithHelp id="clientId" text={t('labels.clientId')} help={t('help.clientId')} />
            <InputText id="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder={t('placeholders.clientId')} className={!clientIdValid ? 'p-invalid' : ''} />
            {!clientIdValid && (
              <small className="p-error block mt-1">{clientId ? t('errors.clientIdInvalid') : t('errors.clientIdRequired')}</small>
            )}
          </div>

          <div className="col-12 md:col-6">
            <LabelWithHelp id="scopes" text={t('labels.scopes')} help={t('help.scopes')} />
            <InputText id="scopes" value={scopes} onChange={(e) => setScopes(e.target.value)} placeholder={t('placeholders.scopes')} />
          </div>
        </div>
      </div>

      {/* Read-only resolved endpoints and derived values */}
  <div className="surface-0 py-3 px-0 border-round">
        <h4 className="mt-0 mb-2">{maybeT('sections.settings.resolvedTitle', 'Resolved (read-only) values')}</h4>
        <p className="mb-3 text-sm opacity-75">{maybeT('sections.settings.resolvedDescription', 'These values are derived from the tenant and other inputs. They are shown for reference and cannot be changed here.')}</p>

        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12 md:col-6">
            <LabelWithHelp id="authEndpoint" text={t('labels.authEndpoint')} help={safeT('help.authEndpoint')} />
            <InputText id="authEndpoint" value={resolvedAuthEndpoint} readOnly placeholder={safeT('placeholders.authEndpoint')} />
          </div>

          <div className="col-12 md:col-6">
            <LabelWithHelp id="tokenEndpoint" text={t('labels.tokenEndpoint')} help={safeT('help.tokenEndpoint')} />
            <InputText id="tokenEndpoint" value={resolvedTokenEndpoint} readOnly placeholder={safeT('placeholders.tokenEndpoint')} />
          </div>

          <div className="col-12 md:col-6">
            <LabelWithHelp id="redirectUri" text={t('labels.redirectUri')} help={t('help.redirectUri')} />
            <InputText id="redirectUri" value={redirectUri} readOnly placeholder={t('placeholders.redirectUri')} className={!redirectUriValid ? 'p-invalid' : ''} />
            {!redirectUriValid && (
              <small className="p-error block mt-1">{t('errors.redirectUriInvalid')}</small>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
