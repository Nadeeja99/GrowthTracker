import type { Server } from 'http';
import request from 'supertest';
import { testDatabaseUrl } from './test-db';

// Supertest listens on a free port on every address, then connects to 127.0.0.1.
// On a laptop, another program (VS Code, for one) can hold that port on
// 127.0.0.1 alone, and then it answers instead of the app, with a stray 404 or a
// hung-up socket. Those programs don't use IPv6, so connect over that instead.
type WithServer = { serverAddress(app: Server, path: string): string; _server?: Server };
const prototype = (request as unknown as { Test: { prototype: WithServer } }).Test.prototype;
const { serverAddress } = prototype;
prototype.serverAddress = function (this: WithServer, app, path) {
  const url = serverAddress.call(this, app, path);
  const address = (this._server ?? app).address();
  return typeof address === 'object' && address?.family === 'IPv6' ? url.replace('127.0.0.1', '[::1]') : url;
};

// Never read backend/.env during tests (dotenv/config honours this path).
process.env.DOTENV_CONFIG_PATH = '/nonexistent/.env';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl();
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.JWT_SECRET = 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef01234567';
process.env.BCRYPT_ROUNDS = '10';
process.env.CORS_ORIGIN = 'http://localhost:3000';
// Generous limits so suites can create many users; rate-limit.test.ts overrides.
process.env.RATE_LIMIT_MAX_REQUESTS ??= '100000';
process.env.AUTH_RATE_LIMIT_MAX ??= '100000';
delete process.env.API_PROXY_SECRET;
// Tests never call the real AI provider; coach tests use a fake model or server.
delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_BASE_URL;
delete process.env.DEMO_LOGIN_ENABLED;
// Tests capture email with setMailerForTests; never use a real provider.
for (const key of ['MAIL_PROVIDER', 'MAIL_API_KEY', 'MAIL_FROM', 'MAIL_OUTBOX_DIR', 'APP_URL']) delete process.env[key];
process.env.PASSWORD_RESET_RATE_LIMIT_MAX ??= '100000';
// Tests never report to a real Sentry project; monitoring.test.ts uses a local fake.
delete process.env.SENTRY_DSN;
// Tests capture notifications with setPushSenderForTests; push.test.ts sets its own keys.
for (const key of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'DIGEST_CRON_SECRET']) delete process.env[key];
