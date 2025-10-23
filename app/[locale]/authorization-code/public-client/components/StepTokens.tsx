"use client";
import {InputTextarea} from 'primereact/inputtextarea';
import {Button} from 'primereact/button';
import {useTranslations} from 'next-intl';
import LabelWithHelp from '@/components/LabelWithHelp';

type Props = {
  tokenRequestPreview: unknown;
  tokenResponseText: unknown;
  exchanging: boolean;
  onExchangeTokens: () => void | Promise<void>;
  resolvedTokenEndpoint?: string;
};

export default function StepTokens({ tokenRequestPreview, tokenResponseText, exchanging, onExchangeTokens, resolvedTokenEndpoint }: Props) {
  const t = useTranslations('AuthorizationCode.PublicClient');
  const tRaw = (key: string) => {
    try {
      const anyT = t as any;
      if (typeof anyT.raw === 'function') {
        const v = anyT.raw(key);
        if (typeof v === 'string') return v;
      }
    } catch {}
    return t(key as any);
  };
  const toPretty = (v: unknown) => {
    if (typeof v === 'string') return v;
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v ?? '');
    }
  };
  const reqStr = toPretty(tokenRequestPreview);
  const resStr = toPretty(tokenResponseText);
  return (
    <>
      <section>
        <h3 className="mt-0 mb-3">{t('sections.tokens.title')}</h3>
        <p className="mb-3">{t('sections.tokens.description')}</p>
      </section>

      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <h4 className="mt-0 mb-2">{t('sections.tokens.requestTitle', { default: t('labels.tokenRequest') })}</h4>
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <LabelWithHelp id="tokenEndpointPreview" text={t('labels.tokenEndpointPreview', { default: t('labels.tokenEndpoint') })} help={t('help.tokenEndpointPreview')} />
            <InputTextarea id="tokenEndpointPreview" rows={1} autoResize value={resolvedTokenEndpoint ?? ''} readOnly />
          </div>
          <div className="col-12">
            <LabelWithHelp id="tokenRequestBody" text={t('labels.tokenRequest')} help={t('help.tokenRequest')} />
            <InputTextarea id="tokenRequestBody" rows={4} autoResize value={`${reqStr ?? ''}`} />
          </div>
          <div className="col-12">
            <div className="flex gap-2">
              <Button type="button" label={exchanging ? t('buttons.sending') : t('buttons.send')} icon="pi pi-send" onClick={onExchangeTokens} disabled={exchanging || !(`${reqStr ?? ''}`)} />
            </div>
          </div>
        </div>
      </div>

      <div className="surface-0 py-3 px-0 border-round">
        <h4 className="mt-0 mb-2">{t('sections.tokens.responseTitle', { default: t('labels.responsePreview') })}</h4>
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <LabelWithHelp id="tokenResponse" text={t('labels.responsePreview')} help={t('help.responsePreview')} />
            <InputTextarea id="tokenResponse" rows={8} autoResize value={`${resStr ?? ''}`} />
          </div>
        </div>
      </div>
    </>
  );
}
