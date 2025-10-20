"use client";
import {InputTextarea} from 'primereact/inputtextarea';
import {Button} from 'primereact/button';
import {useTranslations} from 'next-intl';
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
  return (
    <section>
      <h3 className="mt-0 mb-3">{t('sections.decode.title')}</h3>
      <p className="mb-3">{t('sections.decode.description')}</p>
      <div className="grid formgrid p-fluid">
        <div className="col-12">
          <LabelWithHelp id="accessToken" text={t('labels.accessToken')} help={t('help.accessToken')} />
          <InputTextarea id="accessToken" rows={3} autoResize value={accessToken} placeholder={t('placeholders.accessToken')} readOnly />
        </div>
        <div className="col-12">
          <LabelWithHelp id="idToken" text={t('labels.idToken')} help={t('help.idToken')} />
          <InputTextarea id="idToken" rows={3} autoResize value={idToken} placeholder={t('placeholders.idToken')} readOnly />
        </div>
        <div className="col-12 flex gap-2">
          <Button type="button" label={t('buttons.decode')} icon="pi pi-code" onClick={onDecodeTokens} disabled={!accessToken && !idToken} />
        </div>
        <div className="col-12 md:col-6">
          <LabelWithHelp id="accessHeader" text={t('labels.accessHeader')} help={t('help.accessHeader')} />
          <InputTextarea id="accessHeader" rows={6} autoResize value={decodedAccessHeader} placeholder={tRaw('placeholders.accessHeader')} />
        </div>
        <div className="col-12 md:col-6">
          <LabelWithHelp id="accessPayload" text={t('labels.accessPayload')} help={t('help.accessPayload')} />
          <InputTextarea id="accessPayload" rows={6} autoResize value={decodedAccessPayload} placeholder={tRaw('placeholders.accessPayload')} />
        </div>
        <div className="col-12 md:col-6">
          <LabelWithHelp id="idHeader" text={t('labels.idHeader')} help={t('help.idHeader')} />
          <InputTextarea id="idHeader" rows={6} autoResize value={decodedIdHeader} placeholder={tRaw('placeholders.idHeader')} />
        </div>
        <div className="col-12 md:col-6">
          <LabelWithHelp id="idPayload" text={t('labels.idPayload')} help={t('help.idPayload')} />
          <InputTextarea id="idPayload" rows={6} autoResize value={decodedIdPayload} placeholder={tRaw('placeholders.idPayload')} />
        </div>
      </div>
    </section>
  );
}
