// Where the Express API lives. The browser never calls it directly: requests
// to /api/* on this app are proxied there, so the app and API share one origin
// and the httpOnly refresh cookie is first-party (no cross-site cookie issues).
// Read at build time, so set it in the build environment too.
const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:5000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The browser pings this to wake the API on Render's free tier (see waitForApi in src/lib/api.ts).
  // Not /health: ad blockers' EasyPrivacy list blocks `||onrender.com/health`.
  env: {
    NEXT_PUBLIC_API_WAKE_URL: `${API_ORIGIN}/`,
    // Ties error reports to the deploy that caused them.
    NEXT_PUBLIC_RELEASE: process.env.RENDER_GIT_COMMIT ?? '',
  },
  // Lets Sentry show real file names. The repository is public, so this reveals nothing new.
  productionBrowserSourceMaps: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }]
  },
}

module.exports = nextConfig
