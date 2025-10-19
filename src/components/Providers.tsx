"use client";
import {NextIntlClientProvider} from 'next-intl';
import {ReactNode} from 'react';
import {SettingsProvider} from './SettingsContext';

type ProvidersProps = {
  locale: string;
  messages: Record<string, any>;
  children: ReactNode;
};

type OptionalProviderProps = ProvidersProps & {
  timeZone?: string;
};

export function Providers({locale, messages, children, timeZone}: OptionalProviderProps) {
  // Client-side onError handler: suppress ENVIRONMENT_FALLBACK warnings but log others.
  const onError = (err: unknown) => {
    try {
      if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'ENVIRONMENT_FALLBACK') {
        return;
      }
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line no-console
    console.error(err);
  };

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone} onError={onError}>
      <SettingsProvider>
        {children}
      </SettingsProvider>
    </NextIntlClientProvider>
  );
}
