import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
	{
		// Build and test output. These are gitignored, but eslint has its own
		// ignore list — without this, one retained Playwright trace drops a vendor
		// bundle into e2e-report/ and `pnpm lint` starts failing on code nobody
		// wrote.
		ignores: [
			'.next/**',
			'e2e-report/**',
			'playwright-report/**',
			'test-results/**',
			'coverage/**',
		],
	},
	...nextCoreWebVitals,
]

export default config
