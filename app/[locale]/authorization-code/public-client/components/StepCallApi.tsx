"use client";
import {InputText} from 'primereact/inputtext';
import {InputTextarea} from 'primereact/inputtextarea';
import {Button} from 'primereact/button';
import {useTranslations} from 'next-intl';
import LabelWithHelp from '@/components/LabelWithHelp';

type Props = {
  apiEndpointUrl: string;
  setApiEndpointUrl: (v: string) => void;
  accessToken: string;
  apiResponseText: string;
  callingApi: boolean;
  onCallApi: () => void | Promise<void>;
};

export default function StepCallApi({ apiEndpointUrl, setApiEndpointUrl, accessToken, apiResponseText, callingApi, onCallApi }: Props) {
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
      <h3 className="mt-0 mb-3">{t('sections.callApi.title')}</h3>
      <p className="mb-3">{t('sections.callApi.description')}</p>
      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12 md:col-8">
          <LabelWithHelp id="apiEndpoint" text={t('labels.apiEndpoint')} help={t('help.apiEndpoint')} />
          <InputText id="apiEndpoint" value={apiEndpointUrl} onChange={(e) => setApiEndpointUrl(e.target.value)} />
          </div>
          <div className="col-12 md:col-4 flex align-items-end">
            <Button type="button" label={callingApi ? t('buttons.sending') : t('buttons.sendGet')} icon="pi pi-send" className="w-full md:w-auto" onClick={onCallApi} disabled={callingApi || !apiEndpointUrl || !accessToken} />
          </div>
          <div className="col-12">
            <LabelWithHelp id="apiHeaders" text={t('labels.apiHeaders')} help={t('help.apiHeaders')} />
            <InputTextarea id="apiHeaders" rows={3} autoResize value={accessToken ? `Authorization: Bearer ${accessToken}` : ''} />
          </div>
          <div className="col-12">
            <LabelWithHelp id="apiResponse" text={t('labels.apiResponse')} help={t('help.apiResponse')} />
            <InputTextarea id="apiResponse" rows={8} autoResize value={apiResponseText} />
          </div>
        </div>
      </div>
    </section>
  );
}
