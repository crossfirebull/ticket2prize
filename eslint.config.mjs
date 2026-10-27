import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Prize photos are pre-sized JPEGs served as static files; no optimizer needed.
      '@next/next/no-img-element': 'off',
      // Pages Router rule; the App Router root layout applies to every page.
      '@next/next/no-page-custom-font': 'off',
    },
  },
  { ignores: ['.next/**', 'dist/**', 'next-env.d.ts', 'backend/**', 'frontend/**', 'playwright-report/**', 'test-results/**'] },
]

export default config
