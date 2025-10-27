import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {ReactNode} from 'react';

// PrimeReact core and theme CSS
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
import Sidebar from './Sidebar';
import {Providers} from '../../src/components/Providers';
import {ScrollPanel} from 'primereact/scrollpanel';

export const metadata: Metadata = {
  title: 'Next.js + PrimeReact + i18n',
  description: 'Skeleton app with next-intl and PrimeReact, deploy-ready for Vercel.'
};

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  // Load locale messages with a safe fallback strategy:
  // 1. Try the requested locale file
  // 2. Fallback to English
  // 3. Fallback to an empty messages object
  let messages: Record<string, unknown> = {};
  try {
    // dynamic import for the requested locale
    messages = (await import(`../../src/messages/${locale}.json`)).default;
  } catch (err) {
    // If the requested locale is missing, try English
    try {
      messages = (await import(`../../src/messages/en.json`)).default;
    } catch (err2) {
      // final fallback: empty messages
      messages = {};
    }
  }
  // Determine a server-side timezone for deterministic formatting during SSR.
  // Intl may not expose a timezone in some Node builds; default to UTC.
  let timeZone = 'UTC';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) timeZone = tz;
  } catch (e) {
    // swallow - keep UTC
  }


    return (
        <>
          <Providers locale={locale} messages={messages} timeZone={timeZone}>
            {/* App-wide top header spanning sidebar and main content */}
            <header className="app-header">
              <div className="app-header-inner">OAuth Playground</div>
            </header>

            {/* Left navigation sidebar */}
            <Sidebar locale={locale} />

            {/* Main scrollable content area */}
            <ScrollPanel
              style={{
                height: 'calc(100vh - var(--header-height))',
                marginLeft: 416,
                marginTop: 'var(--header-height)'
              }}
              className="p-0"
            >
              {children}
            </ScrollPanel>
          </Providers>
        </>
    );
}

export function generateStaticParams() {
  return [{locale: 'en'}, {locale: 'de'}];
}
