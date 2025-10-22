"use client";
import {InputText} from 'primereact/inputtext';
import {InputTextarea} from 'primereact/inputtextarea';
import {Button} from 'primereact/button';
import {Dropdown} from 'primereact/dropdown';
import {useTranslations} from 'next-intl';
import LabelWithHelp from '@/components/LabelWithHelp';

type Props = {
  responseType: string;
  stateParam: string;
  setStateParam: (v: string) => void;
  onGenerateState: () => void;
  nonce: string;
  setNonce: (v: string) => void;
  onGenerateNonce: () => void;
  responseMode: string;
  setResponseMode: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  loginHint: string;
  setLoginHint: (v: string) => void;
  authUrlPreview: string;
  onOpenPopup: () => void;
};

export default function StepAuthorize({ responseType, stateParam, setStateParam, onGenerateState, nonce, setNonce, onGenerateNonce, responseMode, setResponseMode, prompt, setPrompt, loginHint, setLoginHint, authUrlPreview, onOpenPopup }: Props) {
  const t = useTranslations('AuthorizationCode.PublicClient');
  const responseModeOptions = [
    { label: 'query', value: 'query' },
    { label: 'form_post', value: 'form_post' }
  ];
  const promptOptions = [
    { label: 'login', value: 'login' },
    { label: 'consent', value: 'consent' },
    { label: 'select_account', value: 'select_account' },
    { label: 'none', value: 'none' }
  ];
  return (
    <section>
      <h3 className="mt-0 mb-3">{t('sections.authorize.title')}</h3>
      <p className="mb-3">{t('sections.authorize.description')}</p>
      {/* Editable settings provided by the user */}
      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <h4 className="mt-0 mb-2">{t('sections.settings.userProvidedTitle')}</h4>
        <p className="mb-3 text-sm opacity-75">{t('sections.settings.userProvidedDescription')}</p>

        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12 md:col-6">
            <LabelWithHelp id="responseType" text={t('labels.responseType')} help={t('help.responseType')} />
            <InputText id="responseType" value={responseType} readOnly />
          </div>

          <div className="col-12 md:col-6">
            <LabelWithHelp id="state" text={t('labels.state')} help={t('help.state')} />
            <div className="flex gap-2 align-items-center">
              <InputText id="state" className="flex-1" value={stateParam} onChange={(e) => setStateParam(e.target.value)} placeholder={t('placeholders.state')} />
              <Button
                type="button"
                icon="pi pi-refresh"
                onClick={onGenerateState}
                rounded
                severity="info"
                className="shadow-2"
                aria-label={t('buttons.generate')}
                title={t('buttons.generate')}
              />
            </div>
          </div>

          <div className="col-12 md:col-6">
            <LabelWithHelp id="nonce" text={t('labels.nonce')} help={t('help.nonce')} />
            <div className="flex gap-2 align-items-center">
              <InputText id="nonce" className="flex-1" value={nonce} onChange={(e) => setNonce(e.target.value)} placeholder={t('placeholders.nonce')} />
              <Button
                type="button"
                icon="pi pi-refresh"
                onClick={onGenerateNonce}
                rounded
                severity="info"
                className="shadow-2"
                aria-label={t('buttons.generate')}
                title={t('buttons.generate')}
              />
            </div>
          </div>

          <div className="col-12 md:col-6">
            <LabelWithHelp id="responseMode" text={t('labels.responseMode')} help={t('help.responseMode')} />
            <Dropdown id="responseMode" value={responseMode} onChange={(e) => setResponseMode(e.value)} options={responseModeOptions} placeholder={t('placeholders.selectMethod')} />
          </div>

          <div className="col-12 md:col-6">
            <LabelWithHelp id="prompt" text={t('labels.prompt')} help={t('help.prompt')} />
            <Dropdown id="prompt" value={prompt} onChange={(e) => setPrompt(e.value)} options={promptOptions} placeholder={t('placeholders.selectMethod')} />
          </div>

          <div className="col-12 md:col-6">
            <LabelWithHelp id="loginHint" text={t('labels.loginHint')} help={t('help.loginHint')} />
            <InputText id="loginHint" value={loginHint} onChange={(e) => setLoginHint(e.target.value)} placeholder={t('placeholders.loginHint')} />
          </div>
        </div>
      </div>

      {/* Read-only resolved values */}
      <div className="surface-0 py-3 px-0 border-round">
        <h4 className="mt-0 mb-2">{t('sections.settings.resolvedTitle')}</h4>
        <p className="mb-3 text-sm opacity-75">{t('sections.settings.resolvedDescription')}</p>

        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <LabelWithHelp id="authUrlPreview" text={t('labels.authUrlPreview')} help={t('help.authUrlPreview')} />
            <InputTextarea id="authUrlPreview" rows={3} autoResize value={authUrlPreview} readOnly placeholder={t('placeholders.authUrlPreview')} />
          </div>

          <div className="col-12">
            <div className="flex gap-2">
              <Button type="button" className="w-full" label={t('buttons.openPopup')} icon="pi pi-external-link" onClick={onOpenPopup} disabled={!authUrlPreview} />
            </div>
          </div>
        </div>
      </div>

      
    </section>
  );
}
