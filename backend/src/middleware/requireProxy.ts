import { timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

const expected = env.API_PROXY_SECRET ? Buffer.from(env.API_PROXY_SECRET) : null;

/**
 * In production the API sits behind the Next.js app's /api proxy, which adds a
 * shared secret header. Requests without it (direct calls to the API's public
 * URL) are refused, so X-Forwarded-For can only come from our own proxy chain
 * and per-IP rate limits can't be dodged by forging it. /health stays open for
 * the platform's health checks.
 */
export const requireProxy = (req: Request, res: Response, next: NextFunction): void => {
  if (!expected || req.path === '/health') return next();
  const given = Buffer.from(req.get('x-proxy-secret') ?? '');
  if (given.length === expected.length && timingSafeEqual(given, expected)) return next();
  res.status(403).json({ success: false, error: 'Forbidden' });
};
