// Where the Express API lives. The browser never calls it directly: requests
// to /api/* on this app are proxied there, so the app and API share one origin
// and the httpOnly refresh cookie is first-party (no cross-site cookie issues).
// Read at build time, so set it in the build environment too.
const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:5000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // For links calendar apps fetch straight from the API (see CalendarSettings).
    NEXT_PUBLIC_API_ORIGIN: API_ORIGIN,
    // Ties error reports to the deploy that caused them.
    NEXT_PUBLIC_RELEASE: process.env.VERCEL_GIT_COMMIT_SHA ?? '',
  },
  // Lets Sentry show real file names. The repository is public, so this reveals nothing new.
  productionBrowserSourceMaps: true,
  async headers() {
    return [
      // Always check for a new service worker instead of trusting a cached copy.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
    ]
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }]
  },
}

module.exports = nextConfig
