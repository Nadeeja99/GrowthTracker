import { testDatabaseUrl } from './test-db';

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
