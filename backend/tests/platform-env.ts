// Imported first by platform.test.ts: config is read once when src/config/env
// loads, so overrides must be in place before any app module is imported.
process.env.AUTH_RATE_LIMIT_MAX = '3';
process.env.API_PROXY_SECRET = 'proxy-secret-for-tests-0123456789abcdef';
