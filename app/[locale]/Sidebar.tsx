"use client";
import {useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {PanelMenu} from 'primereact/panelmenu';
import type {MenuItem} from 'primereact/menuitem';

export default function Sidebar({locale}: {locale: string}) {
  const t = useTranslations('Sidebar');
  const router = useRouter();
  const nextLocale = locale === 'en' ? 'de' : 'en';

  const items: MenuItem[] = [
    {
      label: t('home'),
      command: () => router.push(`/${locale}`)
    },
    {
      label: t('authorizationCode'),
      items: [
        {
          label: t('publicClient'),
          command: () => router.push(`/${locale}/authorization-code/public-client`)
        },
        {
          label: t('confidentialClient'),
          command: () => router.push(`/${locale}/authorization-code/confidential-client`)
        }
      ]
    },
    {
      label: t('language'),
      items: [
        {
          label: t('switchTo', {lang: nextLocale.toUpperCase()}),
          command: () => router.push(`/${nextLocale}`)
        }
      ]
    }
  ];

  return (
    <aside className="sidebar p-3">
      <PanelMenu model={items} />
    </aside>
  );
}
