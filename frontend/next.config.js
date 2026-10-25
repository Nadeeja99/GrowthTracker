// Where the Express API lives. The browser never calls it directly: requests
// to /api/* on this app are proxied there, so the app and API share one origin
// and the httpOnly refresh cookie is first-party (no cross-site cookie issues).
// Read at build time, so set it in the build environment too.
const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:5000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }]
  },
}

module.exports = nextConfig
