"use client";
import {useTranslations} from 'next-intl';
import {Card} from 'primereact/card';
import {InputText} from 'primereact/inputtext';
import {useSettings} from '../../../src/components/SettingsContext';
import {useState, useEffect} from 'react';

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const {settings, setSettings} = useSettings();
  const [tenantId, setTenantId] = useState(settings.entraTenantId || '');

  useEffect(() => {
    setTenantId(settings.entraTenantId || '');
  }, [settings.entraTenantId]);

  const onSave = () => {
    setSettings({entraTenantId: tenantId});
  };
  return (
    <div className="p-4">
      <Card title={t('title')}>
        <div className="p-fluid">
          <div className="p-field">
            <label htmlFor="entraTenantId" className="p-d-block">{t('entraTenantIdLabel')}</label>
            <InputText id="entraTenantId" value={tenantId} onChange={(e) => setTenantId((e.target as HTMLInputElement).value)} className="p-d-block"/>
            <small className="p-d-block p-mt-2">{t('entraTenantIdHint')}</small>
          </div>
          <div className="p-field p-mt-3">
            <button className="p-button p-component" onClick={onSave}>
              <span className="p-button-label">{t('save')}</span>
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
