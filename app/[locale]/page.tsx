"use client";
import {useTranslations} from 'next-intl';
import {Card} from 'primereact/card';

export default function HomePage() {
  const t = useTranslations('Home');
  return (
    <div className="p-4">
      <Card title={t('title')}>
        <p>{t('intro')}</p>
      </Card>
    </div>
  );
}
