"use client";
import {useTranslations} from 'next-intl';
import {Card} from 'primereact/card';

export default function AuthorizationCodeConfidentialClientPage() {
  const t = useTranslations('AuthorizationCode');
  return (
    <div className="p-4">
      <Card title={t('confidentialClientTitle')}>
        <p>{t('confidentialClientPlaceholder')}</p>
      </Card>
    </div>
  );
}
