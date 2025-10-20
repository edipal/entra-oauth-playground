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
};

export default function StepTokens({ tokenRequestPreview, tokenResponseText, exchanging, onExchangeTokens }: Props) {
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
    <section>
      <h3 className="mt-0 mb-3">{t('sections.tokens.title')}</h3>
      <p className="mb-3">{t('sections.tokens.description')}</p>
      <div className="grid formgrid p-fluid">
        <div className="col-12">
          <LabelWithHelp id="tokenRequestBody" text={t('labels.tokenRequest')} help={t('help.tokenRequest')} />
          <InputTextarea id="tokenRequestBody" rows={4} autoResize value={`${reqStr ?? ''}`} placeholder={t('placeholders.tokenRequest')} />
        </div>
        <div className="col-12 flex gap-2">
          <Button type="button" label={exchanging ? t('buttons.sending') : t('buttons.send')} icon="pi pi-send" onClick={onExchangeTokens} disabled={exchanging || !(`${reqStr ?? ''}`)} />
        </div>
        <div className="col-12">
          <LabelWithHelp id="tokenResponse" text={t('labels.responsePreview')} help={t('help.responsePreview')} />
          <InputTextarea id="tokenResponse" rows={8} autoResize value={`${resStr ?? ''}`} placeholder={tRaw('placeholders.tokenResponse')} />
        </div>
      </div>
    </section>
  );
}
