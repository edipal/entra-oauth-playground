import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {ReactNode} from 'react';

// PrimeReact core and theme CSS
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
import Sidebar from './Sidebar';
import Image from 'next/image';
import {Providers} from '../../src/components/Providers';
// Use native scrolling for the main content area to avoid duplicate scrollbars

export const metadata: Metadata = {
  title: 'ENTRA OAuth Playground',
  description: 'Playground to experiment with OAuth flows and Microsoft Entra ID',
  icons: {
    icon: '/logo.png'
  }
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
              <div className="app-header-inner">
                <div className="app-logo">
                  <Image src="/logo.png" alt="OAuth Playground logo" width={40} height={40} priority />
                </div>
                <div className="app-title">ENTRA OAuth Playground</div>
              </div>
            </header>

            {/* Left navigation sidebar */}
            <Sidebar locale={locale} />

            {/* Main scrollable content area (use native scrolling to avoid duplicate scrollbars) */}
            <main
              style={{
                height: 'calc(100vh - var(--header-height))',
                marginLeft: 'var(--sidebar-width)',
                marginTop: 'var(--header-height)',
                overflow: 'auto'
              }}
              className="p-0"
            >
              {children}
            </main>
          </Providers>
        </>
    );
}

export function generateStaticParams() {
  return [{locale: 'en'}, {locale: 'de'}];
}
