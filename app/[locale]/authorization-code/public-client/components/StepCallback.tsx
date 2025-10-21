"use client";
import {InputText} from 'primereact/inputtext';
import {InputTextarea} from 'primereact/inputtextarea';
import {useTranslations} from 'next-intl';
import LabelWithHelp from '@/components/LabelWithHelp';

type Props = {
  callbackUrl: string;
  authCode: string;
  extractedState: string;
  expectedState?: string;
};

export default function StepCallback({ callbackUrl, authCode, extractedState, expectedState }: Props) {
  const t = useTranslations('AuthorizationCode.PublicClient');
  const hasExpected = !!(expectedState && expectedState.length > 0);
  const stateMatches = hasExpected && expectedState === extractedState;
  return (
    <section>
      <h3 className="mt-0 mb-3">{t('sections.callback.title')}</h3>
      <p className="mb-3">{t('sections.callback.description')}</p>
      <div className="mb-3 flex gap-3 align-items-start">
        <span className="pi pi-info-circle mr-2" style={{ color: 'var(--blue-500)', fontSize: '1.25rem', marginTop: '0.15rem' }} aria-hidden="true" />
        <p className="mb-3" style={{ margin: 0 }}>{t('help.checkStateAlways')}</p>
      </div>
      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <LabelWithHelp id="callbackUrl" text={t('labels.callbackUrl')} help={t('help.callbackUrl')} />
            <InputTextarea id="callbackUrl" rows={3} autoResize value={callbackUrl} placeholder={t('placeholders.callbackUrl')} />
          </div>
          <div className="col-12 md:col-6">
            <LabelWithHelp id="authCode" text={t('labels.extractedCode')} help={t('help.extractedCode')} />
            <InputText id="authCode" value={authCode} placeholder={t('placeholders.extractedCode')} readOnly />
          </div>
          <div className="col-12 md:col-6">
            <LabelWithHelp id="extractedState" text={t('labels.extractedState')} help={t('help.extractedState')} />
            <InputText id="extractedState" value={extractedState} placeholder={t('placeholders.extractedState')} readOnly />
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
        </div>
      </div>
    </section>
  );
}
