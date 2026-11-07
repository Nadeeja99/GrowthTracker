import { FAKE_SENTRY_PORT } from './monitoring-env'; // must stay the first import
import http from 'http';
import { randomUUID } from 'crypto';
import request from 'supertest';
import * as Sentry from '@sentry/node';
import { Prisma } from '@prisma/client';
import { app } from '../src/app';
import { setMailerForTests } from '../src/services/mail';
import { prisma, registerUser, resetDatabase } from './helpers';

// Random at runtime: Sentry quotes source lines, so a literal would match itself.
const secret = randomUUID();
const received: string[] = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    received.push(body);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
  });
});

const sentEvents = async () => {
  await Sentry.flush(2_000);
  return received.splice(0).filter(envelope => envelope.includes('"type":"event"')).join('\n');
};

beforeAll(async () => {
  await resetDatabase();
  await new Promise<void>(resolve => { server.listen(FAKE_SENTRY_PORT, '127.0.0.1', resolve); });
});
afterAll(async () => {
  await Sentry.close(2_000);
  await new Promise(resolve => { server.close(resolve); });
  await prisma.$disconnect();
});
afterEach(() => {
  jest.restoreAllMocks();
  setMailerForTests(undefined);
});

describe('error reporting', () => {
  it('reports an unexpected 500 without any request data', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(new Error('database exploded'));

    const res = await request(app).post('/api/auth/login')
      .set('x-proxy-secret', secret)
      .set('Authorization', `Bearer ${secret}`)
      .set('Cookie', `refreshToken=${secret}`)
      .query({ token: secret })
      .send({ email: `${secret}@example.test`, password: secret });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');

    const sent = await sentEvents();
    expect(sent).toContain('database exploded');
    expect(sent).toContain(res.body.requestId);
    expect(sent).not.toContain(secret);
    expect(sent).not.toContain('ip_address');
    expect(sent).not.toContain('"vars"'); // local variables
  });

  it('stays quiet about expected errors', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }));

    const conflict = await request(app).post('/api/auth/login')
      .send({ email: 'someone@example.test', password: 'a-password' });
    const invalid = await request(app).post('/api/auth/login').send({});
    const missing = await request(app).get('/api/nope');

    expect([conflict.status, invalid.status, missing.status]).toEqual([409, 400, 404]);
    expect(await sentEvents()).toBe('');
  });

  it('reports a reset email that failed after the response was sent', async () => {
    const { email } = await registerUser(app);
    setMailerForTests({ send: () => Promise.reject(new Error('provider rejected the email')) });

    const res = await request(app).post('/api/auth/password/forgot').send({ email });
    expect(res.status).toBe(200);

    await new Promise(resolve => setTimeout(resolve, 300)); // the email is sent after the response
    const sent = await sentEvents();
    expect(sent).toContain('provider rejected the email');
    expect(sent).not.toContain(email);
  });
});
