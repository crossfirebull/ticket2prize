import type { NextConfig } from 'next'

const config: NextConfig = {
  // A self-contained server in .next/standalone, which is all the Docker image ships.
  output: 'standalone',
  poweredByHeader: false,
  // Prize photos are pre-sized static files, so the image optimizer (and its 45 MB of
  // sharp binaries) stays out of the image.
  images: { unoptimized: true },
  outputFileTracingExcludes: { '*': ['node_modules/@img/**', 'node_modules/sharp/**'] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      { source: '/prizes/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] },
    ]
  },
}

export default config
