"use client";
import {InputText} from 'primereact/inputtext';
import {Button} from 'primereact/button';
import {useTranslations} from 'next-intl';
import LabelWithHelp from '@/components/LabelWithHelp';

type Props = {
  codeVerifier: string;
  setCodeVerifier: (v: string) => void;
  codeChallenge: string;
  onGeneratePkce: () => void | Promise<void>;
  codeVerifierValid?: boolean;
  codeChallengeValid?: boolean;
};

export default function StepPkce({ codeVerifier, setCodeVerifier, codeChallenge, onGeneratePkce, codeVerifierValid = true, codeChallengeValid = true }: Props) {
  const t = useTranslations('AuthorizationCode.PublicClient');
  // consider a field invalid if it's empty OR the caller explicitly marks it invalid
  const hasCodeVerifier = !!(codeVerifier && codeVerifier.trim().length > 0);
  const hasCodeChallenge = !!(codeChallenge && codeChallenge.trim().length > 0);
  const showCodeVerifierInvalid = !hasCodeVerifier || codeVerifierValid === false;
  const showCodeChallengeInvalid = !hasCodeChallenge || codeChallengeValid === false;
  return (
    <section>
      <h3 className="mt-0 mb-3">{t('sections.pkce.title')}</h3>
  <p className="mb-3">{t('sections.pkce.description')}</p>
      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12 md:col-8">
          <LabelWithHelp id="codeVerifier" text={t('labels.codeVerifier')} help={t('help.codeVerifier')} />
          <div className="flex gap-2 align-items-center">
            <InputText id="codeVerifier" className={`flex-1${showCodeVerifierInvalid ? ' p-invalid' : ''}`} value={codeVerifier} onChange={(e) => setCodeVerifier(e.target.value)} placeholder={t('placeholders.codeVerifier')} />
            <Button
              type="button"
              icon="pi pi-refresh"
              onClick={onGeneratePkce}
              rounded
              severity="info"
              className="shadow-2"
              aria-label={t('buttons.generate')}
              title={t('buttons.generate')}
            />
          </div>
            {showCodeVerifierInvalid && (
              <small className="p-error block mt-1">{t('errors.codeVerifierRequired')}</small>
            )}
          </div>
          <div className="col-12 md:col-8">
          <LabelWithHelp id="codeChallenge" text={t('labels.codeChallenge')} help={t('help.codeChallenge')} />
          <InputText id="codeChallenge" value={codeChallenge} onChange={() => {}} placeholder={t('placeholders.codeChallenge')} readOnly className={showCodeChallengeInvalid ? 'p-invalid' : ''} />
          {showCodeChallengeInvalid && (
            <small className="p-error block mt-1">{t('errors.codeChallengeRequired')}</small>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}
