// Loads and validates environment variables once, at boot. Import this module
// before anything else so every other module sees a populated `process.env`
// and the process refuses to start with a missing or weak configuration.
import 'dotenv/config';
import { z } from 'zod';

const numberFromEnv = (fallback: number) =>
  z.coerce.number().int().nonnegative().default(fallback);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: numberFromEnv(5000),

    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    // Number of reverse-proxy hops in front of the app, needed for correct client
    // IPs (which per-IP rate limiting depends on). On Render behind the Next.js
    // proxy: client -> Render -> Next.js -> Render -> API = 2.
    TRUST_PROXY: numberFromEnv(0),
    // Shared with the Next.js app; when set, only requests carrying it are served.
    API_PROXY_SECRET: z.string().min(32, 'API_PROXY_SECRET must be at least 32 characters').optional(),

    RATE_LIMIT_WINDOW_MS: numberFromEnv(15 * 60 * 1000),
    // An app page load makes ~8 API calls (plus refetches on focus), so this
    // must leave real headroom; it still stops scripted abuse.
    RATE_LIMIT_MAX_REQUESTS: numberFromEnv(600),
    AUTH_RATE_LIMIT_MAX: numberFromEnv(10),

    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  })
  .refine(env => env.JWT_SECRET !== env.JWT_REFRESH_SECRET, {
    message: 'JWT_REFRESH_SECRET must differ from JWT_SECRET',
    path: ['JWT_REFRESH_SECRET'],
  })
  .refine(env => env.NODE_ENV !== 'production' || !!env.API_PROXY_SECRET, {
    message: 'API_PROXY_SECRET is required in production (the API must only be reachable through the app proxy)',
    path: ['API_PROXY_SECRET'],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map(issue => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // The logger is not available yet (it depends on this module).
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
};
