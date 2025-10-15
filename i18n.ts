import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async ({locale}) => ({
  locale: locale as string,
  messages: (await import(`./src/messages/${locale}.json`)).default
}));

export const locales = ['en', 'de'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'en';
