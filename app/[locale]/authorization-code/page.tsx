"use client";
import {useTranslations} from 'next-intl';
import {Card} from 'primereact/card';

export default function AuthorizationCodePage() {
  const t = useTranslations('AuthorizationCode');
  return (
    <div className="p-4">
      <Card title={t('title')}>
        <p>{t('placeholder')}</p>
      </Card>
    </div>
  );
}
