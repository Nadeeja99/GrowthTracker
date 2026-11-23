import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs for /api/* before next.config.js proxies the request to the Express API.
 * In production the API only accepts requests carrying this shared secret, so
 * it can't be called directly (which would let clients forge their IP address
 * and dodge per-IP rate limits). Any client-supplied value is overwritten.
 *
 * It also passes on the visitor's IP address in X-Client-IP. The API sees this
 * app's server as the client, because Vercel replaces X-Forwarded-For on every
 * hop, so it uses this header instead (only on requests with the secret).
 */
export function proxy(request: NextRequest) {
  const secret = process.env.API_PROXY_SECRET;
  if (!secret) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.set('x-proxy-secret', secret);
  headers.delete('x-client-ip');
  // On Vercel, X-Forwarded-For is set by Vercel itself, so it can be trusted.
  const clientIp = process.env.VERCEL ? request.headers.get('x-forwarded-for')?.split(',')[0].trim() : undefined;
  if (clientIp) headers.set('x-client-ip', clientIp);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: '/api/:path*',
};
