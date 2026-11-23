// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

// NextResponse.next({ request: { headers } }) hands the rewritten request
// headers to Next.js as `x-middleware-request-<name>` response headers.
const forwarded = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`);

const call = (headers: Record<string, string>) =>
  proxy(new NextRequest('https://app.test/api/goals', { headers }));

afterEach(() => vi.unstubAllEnvs());

describe('API proxy', () => {
  it('adds the shared secret and, on Vercel, the visitor’s IP from Vercel’s X-Forwarded-For', () => {
    vi.stubEnv('API_PROXY_SECRET', 'proxy-secret');
    vi.stubEnv('VERCEL', '1');
    const res = call({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'x-client-ip': '198.51.100.1', 'x-proxy-secret': 'forged' });
    expect(forwarded(res, 'x-proxy-secret')).toBe('proxy-secret');
    expect(forwarded(res, 'x-client-ip')).toBe('203.0.113.7');
  });

  it('off Vercel, drops a client-supplied IP instead of passing it on', () => {
    vi.stubEnv('API_PROXY_SECRET', 'proxy-secret');
    vi.stubEnv('VERCEL', '');
    const res = call({ 'x-forwarded-for': '203.0.113.7', 'x-client-ip': '198.51.100.1' });
    expect(forwarded(res, 'x-proxy-secret')).toBe('proxy-secret');
    expect(forwarded(res, 'x-client-ip')).toBeNull();
  });

  it('leaves requests alone when no secret is configured (local development)', () => {
    vi.stubEnv('API_PROXY_SECRET', '');
    expect(forwarded(call({ 'x-forwarded-for': '203.0.113.7' }), 'x-proxy-secret')).toBeNull();
  });
});
