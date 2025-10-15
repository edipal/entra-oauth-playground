import {getRequestConfig, getLocale} from 'next-intl/server';

export default getRequestConfig(async () => {
  const locale = await getLocale();
  return {
    locale,
    messages: (await import(`../src/messages/${locale}.json`)).default
  };
});
