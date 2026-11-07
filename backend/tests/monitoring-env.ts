// Imported first by monitoring.test.ts: the DSN points at a local fake of
// Sentry's ingest endpoint, and config is read once when src/config/env loads.
export const FAKE_SENTRY_PORT = 5199;
process.env.SENTRY_DSN = `http://publickey@127.0.0.1:${FAKE_SENTRY_PORT}/1`;
