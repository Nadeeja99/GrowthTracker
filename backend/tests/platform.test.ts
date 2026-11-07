import './platform-env'; // must stay the first import
import request from 'supertest';
import { app } from '../src/app';
import { prisma, resetDatabase } from './helpers';

const viaProxy = { 'x-proxy-secret': process.env.API_PROXY_SECRET! };

beforeAll(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('proxy gate', () => {
  it('refuses API requests that did not come through the app proxy', async () => {
    expect((await request(app).get('/api/goals')).status).toBe(403);
    expect((await request(app).get('/api/goals').set('x-proxy-secret', 'wrong')).status).toBe(403);
  });

  it('lets proxied requests through and keeps /health open for the platform', async () => {
    expect((await request(app).get('/api/goals').set(viaProxy)).status).toBe(401); // reached auth
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.database).toBe('up');
  });

  it('offers the health check through the proxy, for monitoring the whole chain', async () => {
    expect((await request(app).get('/api/health')).status).toBe(403);
    const res = await request(app).get('/api/health').set(viaProxy);
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('up');
  });

  it('hides the scheduled digest job until a secret is configured', async () => {
    expect((await request(app).post('/internal/digests/run')).status).toBe(404);
  });

  it('leaves calendar feeds reachable by calendar apps, without the proxy secret', async () => {
    expect((await request(app).get('/calendar/not-a-real-token.ics')).status).toBe(404);
  });

  it('answers the app’s cross-origin wake-up ping on / without the secret', async () => {
    const res = await request(app).get('/').set('Origin', 'http://localhost:3000');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});

describe('platform behaviour', () => {
  it('tags every response with a request id', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('answers unknown routes with 404 JSON', async () => {
    const res = await request(app).get('/api/nope').set(viaProxy);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('rate-limits failed logins per IP', async () => {
    const attempt = () => request(app).post('/api/auth/login').set(viaProxy)
      .send({ email: 'ghost@example.test', password: 'wrong-password' });
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await attempt()).status);
    expect(statuses).toEqual([401, 401, 401, 429]);
  });

  // Runs after the failed-login test: being locked out of sign-in must not block a reset.
  it('rate-limits "forgot password" requests per IP, separately from failed sign-ins', async () => {
    const ask = () => request(app).post('/api/auth/password/forgot').set(viaProxy).send({ email: 'someone@example.test' });
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await ask()).status);
    expect(statuses).toEqual([200, 200, 429]);
  });
});
