/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // The dev filesystem pack cache corrupts on this volume (rename ENOENT,
  // "invalid stored block lengths", stale chunk maps → 404 chunks and an
  // unpainted canvas). Disable it in dev; production builds are unaffected.
  webpack: (config, { dev }) => {
    if (dev) config.cache = false
    return config
  },
}

// Next serves the live UI; Pages supplies local D1/R2-backed routes.
// Keep this proxy out of the production static export.
module.exports = (phase) => phase === require('next/constants').PHASE_DEVELOPMENT_SERVER
  ? {
      ...nextConfig,
      output: undefined,
      async rewrites() {
        return [
          { source: '/api/:path*', destination: 'http://127.0.0.1:8788/api/:path*' },
          { source: '/p/:stack/:slug/:asset+', destination: 'http://127.0.0.1:8788/p/:stack/:slug/:asset+' },
        ]
      },
    }
  : nextConfig
