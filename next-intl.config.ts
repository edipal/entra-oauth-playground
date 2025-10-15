const config = {
	locales: ['en', 'de'],
	defaultLocale: 'en'
};

export default config;
export const locales = config.locales;
export const defaultLocale = config.defaultLocale as (typeof config.locales)[number];
