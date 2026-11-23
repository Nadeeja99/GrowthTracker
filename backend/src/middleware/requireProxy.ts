import { timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

const expected = env.API_PROXY_SECRET ? Buffer.from(env.API_PROXY_SECRET) : null;

/**
 * In production the API sits behind the Next.js app's /api proxy, which adds a
 * shared secret header. Requests without it (direct calls to the API's public
 * URL) are refused, so the client IP can only come from our own proxy and
 * per-IP rate limits can't be dodged by forging it. /health stays open for the
 * platform's health checks, and the scheduled jobs under /internal have their
 * own secret (requireCronSecret). Calendar apps can't send this header, and the
 * URL they use holds a secret of its own.
 */
const OPEN_PATHS = ['/health'];

export const requireProxy = (req: Request, res: Response, next: NextFunction): void => {
  if (!expected || OPEN_PATHS.includes(req.path) || req.path.startsWith('/internal/') || req.path.startsWith('/calendar/')) {
    return next();
  }
  const given = Buffer.from(req.get('x-proxy-secret') ?? '');
  if (given.length === expected.length && timingSafeEqual(given, expected)) {
    useProxiedClientIp(req);
    return next();
  }
  res.status(403).json({ success: false, error: 'Forbidden' });
};

/**
 * The app sends the visitor's address in X-Client-IP. On Vercel the API can't
 * get it any other way: Vercel replaces X-Forwarded-For with the address that
 * connected, which for proxied requests is the app's server, shared by all
 * visitors. Only called once the secret has been checked.
 */
function useProxiedClientIp(req: Request): void {
  const clientIp = req.get('x-client-ip')?.trim();
  if (clientIp && isIP(clientIp)) {
    Object.defineProperty(req, 'ip', { value: clientIp, configurable: true, enumerable: true });
  }
}
