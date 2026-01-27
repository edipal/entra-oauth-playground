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
  hideAdvanced?: boolean;
};

export default function StepAuthorize({ responseType, stateParam, setStateParam, onGenerateState, nonce, setNonce, onGenerateNonce, responseMode, setResponseMode, prompt, setPrompt, loginHint, setLoginHint, authUrlPreview, onOpenPopup, hideAdvanced }: Props) {
  const t = useTranslations('StepAuthorize');
  const responseModeOptions = [
    { label: t('options.responseMode.query'), value: 'query' },
    { label: t('options.responseMode.form_post'), value: 'form_post' }
  ];
  const promptOptions = [
    { label: t('options.prompt.login'), value: 'login' },
    { label: t('options.prompt.consent'), value: 'consent' },
    { label: t('options.prompt.select_account'), value: 'select_account' },
    { label: t('options.prompt.none'), value: 'none' }
  ];
  return (
    <>
      <p>{t('sections.authorize.description')}</p>
      {/* Editable settings provided by the user */}
      <div className="surface-0 py-3 px-0 border-round mt-5">
        <h5>{t('sections.settings.userProvidedTitle')}</h5>
        <p className="text-sm opacity-75">{t('sections.settings.userProvidedDescription')}</p>

        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(10rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.5rem' }}>
              <div style={{ textAlign: 'left' }}>
                <LabelWithHelp id="responseType" text={t('labels.responseType')} help={t('help.responseType')} />
              </div>
              <div>
                <InputText id="responseType" value={responseType} readOnly style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          <div className="col-12">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(10rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.5rem' }}>
              <div style={{ textAlign: 'left' }}>
                <LabelWithHelp id="state" text={t('labels.state')} help={t('help.state')} />
              </div>
              <div>
                <div className="flex gap-2 align-items-center">
                  <InputText id="state" value={stateParam} onChange={(e) => setStateParam(e.target.value)} placeholder={t('placeholders.state')} style={{ width: '100%' }} />
                  <Button
                    type="button"
                    icon="pi pi-refresh"
                    onClick={onGenerateState}
                    className="shadow-2"
                    aria-label={t('buttons.generate')}
                    title={t('buttons.generate')}
                    style={{ width: '3rem', height: '3rem', minWidth: '2rem', padding: '0.45rem' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="col-12">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(10rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.5rem' }}>
              <div style={{ textAlign: 'left' }}>
                <LabelWithHelp id="nonce" text={t('labels.nonce')} help={t('help.nonce')} />
              </div>
              <div>
                <div className="flex gap-2 align-items-center">
                  <InputText id="nonce" value={nonce} onChange={(e) => setNonce(e.target.value)} placeholder={t('placeholders.nonce')} style={{ width: '100%' }} />
                  <Button
                    type="button"
                    icon="pi pi-refresh"
                    onClick={onGenerateNonce}
                    className="shadow-2"
                    aria-label={t('buttons.generate')}
                    title={t('buttons.generate')}
                    style={{ width: '3rem', height: '3rem', minWidth: '2rem', padding: '0.45rem' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {!hideAdvanced && (
            <>
              <div className="col-12">
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(10rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.5rem' }}>
                  <div style={{ textAlign: 'left' }}>
                    <LabelWithHelp id="responseMode" text={t('labels.responseMode')} help={t('help.responseMode')} />
                  </div>
                  <div>
                    <Dropdown id="responseMode" value={responseMode} onChange={(e) => setResponseMode(e.value)} options={responseModeOptions} placeholder={t('placeholders.selectMethod')} style={{ width: '100%' }} />
                  </div>
                </div>
              </div>

              <div className="col-12">
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(10rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.5rem' }}>
                  <div style={{ textAlign: 'left' }}>
                    <LabelWithHelp id="prompt" text={t('labels.prompt')} help={t('help.prompt')} />
                  </div>
                  <div>
                    <Dropdown id="prompt" value={prompt} onChange={(e) => setPrompt(e.value)} options={promptOptions} placeholder={t('placeholders.selectMethod')} style={{ width: '100%' }} />
                  </div>
                </div>
              </div>

              <div className="col-12">
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(10rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.5rem' }}>
                  <div style={{ textAlign: 'left' }}>
                    <LabelWithHelp id="loginHint" text={t('labels.loginHint')} help={t('help.loginHint')} />
                  </div>
                  <div>
                    <InputText id="loginHint" value={loginHint} onChange={(e) => setLoginHint(e.target.value)} placeholder={t('placeholders.loginHint')} style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Read-only resolved values */}
      <div className="surface-0 py-3 px-0 border-round mt-5">
        <h5>{t('help.authUrlPreview')}</h5>

        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <InputTextarea id="authUrlPreview" rows={6} autoResize value={authUrlPreview} readOnly />
          </div>

          <div className="col-12">
            <div className="flex gap-2">
              <Button type="button" className="w-full" label={t('buttons.openPopup')} icon="pi pi-external-link" onClick={onOpenPopup} disabled={!authUrlPreview} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
