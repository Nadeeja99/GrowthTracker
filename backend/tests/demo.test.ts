import './demo-env';
import request from 'supertest';
import { app } from '../src/app';
import { auth, prisma, resetDatabase } from './helpers';

beforeAll(resetDatabase);
afterAll(() => prisma.$disconnect());

it('says so when the demo account hasn’t been seeded', async () => {
  const res = await request(app).post('/api/auth/demo').send({});
  expect(res.status).toBe(503);
  expect(res.body.error).toMatch(/isn’t set up yet/);
});

describe('with the demo seeded', () => {
  beforeAll(async () => {
    const { seedDemo } = await import('../src/scripts/seed');
    await seedDemo();
  });

  it('signs in without a password and adopts the visitor\'s time zone', async () => {
    const res = await request(app).post('/api/auth/demo').send({ timezone: 'Asia/Colombo' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: 'demo@growthtracker.dev', isDemo: true, timezone: 'Asia/Colombo' });
    expect(res.body.data.user.password).toBeUndefined();
    expect(([] as string[]).concat(res.headers['set-cookie']).some(c => c.startsWith('refreshToken='))).toBe(true);

    const me = await request(app).get('/api/auth/me').set(auth(res.body.data.accessToken));
    expect(me.body.data.user.isDemo).toBe(true);
  });

  it('rejects an invalid time zone', async () => {
    expect((await request(app).post('/api/auth/demo').send({ timezone: 'Mars/Olympus' })).status).toBe(400);
  });

  it('won\'t let one visitor sign everyone out of the shared account', async () => {
    const { accessToken } = (await request(app).post('/api/auth/demo').send({})).body.data;
    const res = await request(app).post('/api/auth/logout-all').set(auth(accessToken));
    expect(res.status).toBe(403);
    expect((await request(app).get('/api/auth/me').set(auth(accessToken))).status).toBe(200);
  });
});
