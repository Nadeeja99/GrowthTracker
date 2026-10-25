import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs for /api/* before next.config.js proxies the request to the Express API.
 * In production the API only accepts requests carrying this shared secret, so
 * it can't be called directly (which would let clients forge X-Forwarded-For
 * and dodge per-IP rate limits). Any client-supplied value is overwritten.
 */
export function proxy(request: NextRequest) {
  const secret = process.env.API_PROXY_SECRET;
  if (!secret) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.set('x-proxy-secret', secret);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: '/api/:path*',
};
