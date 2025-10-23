"use client";
import {InputText} from 'primereact/inputtext';
import {InputTextarea} from 'primereact/inputtextarea';
import {useTranslations} from 'next-intl';
import LabelWithHelp from '@/components/LabelWithHelp';

type Props = {
  callbackUrl: string;
  callbackBody?: string;
  authCode: string;
  extractedState: string;
  expectedState?: string;
};

export default function StepCallback({ callbackUrl, callbackBody = '', authCode, extractedState, expectedState }: Props) {
  const t = useTranslations('AuthorizationCode.PublicClient');
  // Parse callback params early so we can decide whether to show extracted fields
  let callbackParams: URLSearchParams | null = null;
  if (callbackBody && callbackBody.length > 0) {
    // response_mode=form_post: parse params from body
    callbackParams = new URLSearchParams(callbackBody);
  } else {
    // response_mode=query (GET): parse from URL query
    try {
      const url = new URL(callbackUrl);
      callbackParams = new URLSearchParams(url.search);
    } catch (e) {
      const q = (callbackUrl && callbackUrl.includes('?')) ? callbackUrl.split('?')[1] : '';
      callbackParams = new URLSearchParams(q);
    }
  }

  const cbError = callbackParams.get('error') ?? '';
  const cbErrorDescription = callbackParams.get('error_description') ?? '';
  const cbErrorUri = callbackParams.get('error_uri') ?? '';
  const hasCallbackError = !!(cbError || cbErrorDescription || cbErrorUri);
  const hasExpected = !!(expectedState && expectedState.length > 0);
  const stateMatches = hasExpected && expectedState === extractedState;
  return (
    <section>
      <h3 className="mt-0 mb-3">{t('sections.callback.title')}</h3>
      <p className="mb-3">{t('sections.callback.description')}</p>
      <div className="mb-3 flex gap-3 align-items-start">
  <span className="mr-2 flex align-items-center justify-content-center" style={{ backgroundColor: 'var(--blue-500)', color: 'white', width: '1.25rem', height: '1.25rem', borderRadius: '999px', fontSize: '0.75rem', marginTop: '0.1rem' }} aria-hidden="true">i</span>
        <p className="mb-3" style={{ margin: 0 }}>{t('help.checkStateAlways')}</p>
      </div>
      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <LabelWithHelp id="callbackUrl" text={t('labels.callbackUrl')} help={t('help.callbackUrl')} />
            <InputTextarea id="callbackUrl" rows={3} autoResize value={callbackUrl} />
          </div>
          <div className="col-12">
            <LabelWithHelp id="callbackBody" text={t('labels.callbackBody') ?? 'POST body'} help={t('help.callbackBody') ?? 'If response_mode=form_post, the identity provider sends parameters in the POST body.'} />
            <InputTextarea id="callbackBody" rows={3} autoResize value={callbackBody} readOnly />
          </div>
          {!hasCallbackError && (
            <>
              {authCode && (
                <div className="col-12">
                  <div className="mb-3 mt-0 flex gap-2 align-items-center" aria-live="polite">
                    <span className="pi pi-check-circle mr-2" style={{ color: 'var(--green-500)' }} aria-label="callback ok" />
                    <h4 className="m-0">{t('sections.callback.okTitle') ?? 'Callback OK'}</h4>
                  </div>
                </div>
              )}

              <div className="col-12 md:col-6">
                <LabelWithHelp id="authCode" text={t('labels.extractedCode')} help={t('help.extractedCode')} />
                <InputText id="authCode" value={authCode} readOnly />
              </div>
              <div className="col-12 md:col-6">
                <LabelWithHelp id="extractedState" text={t('labels.extractedState')} help={t('help.extractedState')} />
                <InputText id="extractedState" value={extractedState} readOnly />
                {hasExpected && (
                  <div className="mt-2 flex gap-2 align-items-center" aria-live="polite">
                    {stateMatches ? (
                      <span className="pi pi-check-circle mr-2" style={{ color: 'var(--green-500)' }} aria-label="state valid" />
                    ) : (
                      <span className="pi pi-times-circle mr-2" style={{ color: 'var(--red-500)' }} aria-label="state invalid" />
                    )}
                    <span style={{ opacity: 0.9 }}>{stateMatches ? t('help.stateValid') : t('help.stateInvalid')}</span>
                  </div>
                )}
              </div>
            </>
          )}
          {/* Callback error fields: render using parsed callback params (parsed earlier) */}
          {hasCallbackError && (
            <div className="col-12">
              <div className="mt-3 mb-2 flex gap-2 align-items-center" aria-live="polite">
                <span className="pi pi-times-circle mr-2" style={{ color: 'var(--red-500)' }} aria-label="callback error" />
                <h4 className="m-0">{t('sections.callback.errorTitle') ?? 'Callback error'}</h4>
              </div>
              <div className="surface-0 py-3 px-0 border-round">
                <div className="grid formgrid p-fluid gap-3">
                  <div className="col-12 md:col-6">
                    <LabelWithHelp id="callbackError" text={t('labels.error') ?? 'Error'} help={t('help.error') ?? ''} />
                    <InputText id="callbackError" value={cbError} readOnly />
                  </div>
                  <div className="col-12 md:col-6">
                    <LabelWithHelp id="callbackErrorUri" text={t('labels.errorUri') ?? 'Error URI'} help={t('help.errorUri') ?? ''} />
                    <InputText id="callbackErrorUri" value={cbErrorUri} readOnly />
                  </div>
                  <div className="col-12">
                    <LabelWithHelp id="callbackErrorDescription" text={t('labels.errorDescription') ?? 'Error description'} help={t('help.errorDescription') ?? ''} />
                    <InputTextarea id="callbackErrorDescription" rows={3} autoResize value={decodeURIComponent(cbErrorDescription)} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
