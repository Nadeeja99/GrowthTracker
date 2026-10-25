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
});
