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
          label: t('authorizationCodePublicClient'),
          command: () => router.push(`/${locale}/authorization-code/public-client`)
        },
        {
          label: t('authorizationCodeConfidentialClient'),
          command: () => router.push(`/${locale}/authorization-code/confidential-client`)
        }
      ]
    },
    {
      label: t('settings'),
      command: () => router.push(`/${locale}/settings`)
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
      <div className="sidebar-header mb-3">OAuth Playground</div>
      <PanelMenu model={items} />
    </aside>
  );
}
