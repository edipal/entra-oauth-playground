"use client";
import {InputTextarea} from 'primereact/inputtextarea';
import {Button} from 'primereact/button';
import {useTranslations} from 'next-intl';
import {useMemo} from 'react';
import LabelWithHelp from '@/components/LabelWithHelp';

type Props = {
  accessToken: string;
  idToken: string;
  decodedAccessHeader: string;
  decodedAccessPayload: string;
  decodedIdHeader: string;
  decodedIdPayload: string;
  onDecodeTokens: () => void;
};

export default function StepDecode({ accessToken, idToken, decodedAccessHeader, decodedAccessPayload, decodedIdHeader, decodedIdPayload, onDecodeTokens }: Props) {
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
  // Compute rows from content lines so areas grow to show all content
  const calcRows = (value: string, minRows: number) => {
    try {
      const lines = (value ?? '').split('\n').length;
      return Math.max(minRows, (lines + 1) || 1);
    } catch {
      return minRows;
    }
  };
  const rowsAccessHeader = useMemo(() => calcRows(decodedAccessHeader, 6), [decodedAccessHeader]);
  const rowsIdHeader = useMemo(() => calcRows(decodedIdHeader, 6), [decodedIdHeader]);
  const rowsAccessPayload = useMemo(() => calcRows(decodedAccessPayload, 10), [decodedAccessPayload]);
  const rowsIdPayload = useMemo(() => calcRows(decodedIdPayload, 10), [decodedIdPayload]);
  return (
    <section>
      <p className="mb-3">{t('sections.decode.description')}</p>
      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'start', columnGap: '0.75rem', width: '100%' }}>
              <div style={{ textAlign: 'left' }}>
                <LabelWithHelp id="accessToken" text={t('labels.accessToken')} help={t('help.accessToken')} />
              </div>
              <div>
                <InputTextarea
                  id="accessToken"
                  rows={5}
                  autoResize={false}
                  value={accessToken}
                  readOnly
                  wrap="soft"
                  style={{ width: '100%', whiteSpace: 'pre-wrap', overflowY: 'auto', maxHeight: '12rem', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>
          <div className="col-12">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 14rem) 1fr', alignItems: 'start', columnGap: '0.75rem', width: '100%' }}>
              <div style={{ textAlign: 'left' }}>
                <LabelWithHelp id="idToken" text={t('labels.idToken')} help={t('help.idToken')} />
              </div>
              <div>
                <InputTextarea
                  id="idToken"
                  rows={5}
                  autoResize={false}
                  value={idToken}
                  readOnly
                  wrap="soft"
                  style={{ width: '100%', whiteSpace: 'pre-wrap', overflowY: 'auto', maxHeight: '12rem', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>
          <div className="col-12 flex gap-2 mt-3 mb-3">
            <Button type="button" label={t('buttons.decode')} icon="pi pi-code" onClick={onDecodeTokens} disabled={!accessToken && !idToken} />
          </div>
          {/* Two columns: row 1 = both headers, row 2 = both payloads (keeps payloads aligned) */}
          <div className="col-12">
            <div className="w-full" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', alignItems: 'start' }}>
              {/* Row 1: headers — keep order consistent with tokens (Access, then ID) */}
              <div>
                <LabelWithHelp id="accessHeader" text={t('labels.accessHeader')} help={t('help.accessHeader')} />
                <InputTextarea
                  id="accessHeader"
                  rows={rowsAccessHeader}
                  autoResize={false}
                  value={decodedAccessHeader}
                  style={{ width: '100%', whiteSpace: 'pre-wrap', overflowY: 'hidden', resize: 'none' }}
                />
                {/* Hint: Some providers include a JOSE 'nonce' header in access tokens; not used for OIDC nonce validation */}
                {useMemo(() => {
                  try {
                    const obj = JSON.parse(decodedAccessHeader || '{}');
                    return obj && typeof obj === 'object' && 'nonce' in obj;
                  } catch {
                    return (decodedAccessHeader || '').includes('"nonce"');
                  }
                }, [decodedAccessHeader]) && (
                  <div className="mt-2 flex gap-3 align-items-start pl-2">
                    <i
                      className="pi pi-exclamation-circle mr-2"
                      style={{ color: 'var(--yellow-500)', fontSize: '1.1rem', marginTop: '0.2rem' }}
                      aria-hidden="true"
                    />
                    <p className="m-0 text-sm">
                      {(t as any).rich('notes.accessHeaderNonce', {
                        code: (chunks: any) => <code>{chunks}</code>
                      })}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <LabelWithHelp id="idHeader" text={t('labels.idHeader')} help={t('help.idHeader')} />
                <InputTextarea
                  id="idHeader"
                  rows={rowsIdHeader}
                  autoResize={false}
                  value={decodedIdHeader}
                  style={{ width: '100%', whiteSpace: 'pre-wrap', overflowY: 'hidden', resize: 'none' }}
                />
              </div>
              {/* Row 2: payloads (aligned with headers) */}
              <div>
                <LabelWithHelp id="accessPayload" text={t('labels.accessPayload')} help={t('help.accessPayload')} />
                <InputTextarea
                  id="accessPayload"
                  rows={rowsAccessPayload}
                  autoResize={false}
                  value={decodedAccessPayload}
                  style={{ width: '100%', whiteSpace: 'pre-wrap', overflowY: 'hidden', resize: 'none' }}
                />
              </div>
              <div>
                <LabelWithHelp id="idPayload" text={t('labels.idPayload')} help={t('help.idPayload')} />
                <InputTextarea
                  id="idPayload"
                  rows={rowsIdPayload}
                  autoResize={false}
                  value={decodedIdPayload}
                  style={{ width: '100%', whiteSpace: 'pre-wrap', overflowY: 'hidden', resize: 'none' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
