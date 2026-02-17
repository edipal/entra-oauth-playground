/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		ppr: false,
	},
	sassOptions: {
		quietDeps: true,
		silenceDeprecations: ['import', 'legacy-js-api'],
	},
}

const withNextIntl = require('next-intl/plugin')();
 
module.exports = withNextIntl(nextConfig);

