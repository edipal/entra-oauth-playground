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
};

export default function StepPkce({ codeVerifier, setCodeVerifier, codeChallenge, onGeneratePkce }: Props) {
  const t = useTranslations('AuthorizationCode.PublicClient');
  return (
    <section>
      <h3 className="mt-0 mb-3">{t('sections.pkce.title')}</h3>
      <p className="mb-3">{t('sections.pkce.description')}</p>
      <div className="grid formgrid p-fluid">
        <div className="col-12 md:col-8">
          <LabelWithHelp id="codeVerifier" text={t('labels.codeVerifier')} help={t('help.codeVerifier')} />
          <div className="flex gap-2 align-items-center">
            <InputText id="codeVerifier" className="flex-1" value={codeVerifier} onChange={(e) => setCodeVerifier(e.target.value)} placeholder={t('placeholders.codeVerifier')} />
            <Button type="button" icon="pi pi-refresh" onClick={onGeneratePkce} rounded text size="small" aria-label={t('buttons.generate')} title={t('buttons.generate')} />
          </div>
        </div>
        <div className="col-12 md:col-8">
          <LabelWithHelp id="codeChallenge" text={t('labels.codeChallenge')} help={t('help.codeChallenge')} />
          <InputText id="codeChallenge" value={codeChallenge} onChange={() => {}} placeholder={t('placeholders.codeChallenge')} readOnly />
        </div>
      </div>
    </section>
  );
}
