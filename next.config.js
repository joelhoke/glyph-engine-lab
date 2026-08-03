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

module.exports = nextConfig
