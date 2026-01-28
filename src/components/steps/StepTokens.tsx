"use client";
import {InputTextarea} from 'primereact/inputtextarea';
import {Button} from 'primereact/button';
import {useTranslations} from 'next-intl';
import LabelWithHelp from '@/components/LabelWithHelp';
import { TranslationUtils } from '@/lib/translation';

type Props = {
  tokenRequestPreview: unknown;
  tokenResponseText: unknown;
  exchanging: boolean;
  onExchangeTokens: () => void | Promise<void>;
  resolvedTokenEndpoint?: string;
};

export default function StepTokens({ tokenRequestPreview, tokenResponseText, exchanging, onExchangeTokens, resolvedTokenEndpoint }: Props) {
  const t = useTranslations('StepTokens');
  const safeTWithFallback = (key: string, fallback = ''): string =>
    TranslationUtils.safeTWithFallback(t, key, fallback);
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
        <p className="mb-3">{t('sections.tokens.description')}</p>
      </section>

      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <h4 className="mt-0 mb-3">{t('sections.tokens.requestTitle', { default: t('labels.tokenRequest') })}</h4>
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.75rem' }}>
              <div style={{ textAlign: 'left' }}>
                <LabelWithHelp
                  id="tokenEndpointPreview"
                  text={safeTWithFallback(
                    'labels.tokenEndpointPreview',
                    safeTWithFallback('labels.tokenEndpoint', 'Token endpoint')
                  )}
                  help={safeTWithFallback('help.tokenEndpointPreview', '')}
                />
              </div>
              <div>
                <InputTextarea id="tokenEndpointPreview" rows={1} autoResize value={resolvedTokenEndpoint ?? ''} readOnly style={{ width: '100%' }} />
              </div>
            </div>
          </div>
          <div className="col-12">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'center', columnGap: '0.75rem' }}>
              <div style={{ textAlign: 'left' }}>
                <LabelWithHelp id="tokenRequestBody" text={t('labels.tokenRequest')} help={t('help.tokenRequest')} />
              </div>
              <div>
                <InputTextarea 
                  id="tokenRequestBody" 
                  value={`${reqStr ?? ''}`} 
                  autoResize 
                  rows={3}
                  wrap='soft'
                  readOnly
                  style={{ width: '100%', whiteSpace: 'pre-wrap', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>
          <div className="col-12">
            <div className="flex gap-2 mt-3">
              <Button type="button" label={exchanging ? t('buttons.sending') : t('buttons.send')} icon="pi pi-send" onClick={onExchangeTokens} disabled={exchanging || !(`${reqStr ?? ''}`)} />
            </div>
          </div>
        </div>
      </div>

      <div className="surface-0 py-3 px-0 border-round">
        <h4 className="mt-0 mb-3">{t('sections.tokens.responseTitle', { default: t('labels.responsePreview') })}</h4>
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <InputTextarea 
              id="tokenResponse" 
              value={`${resStr ?? ''}`} 
              autoResize
              rows={3} 
              wrap='soft'
              readOnly
              style={{ width: '100%', whiteSpace: 'pre-wrap', resize: 'vertical' }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
