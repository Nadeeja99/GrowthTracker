import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { auth, prisma, registerUser, resetDatabase } from './helpers';

const cookieOf = (res: request.Response) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find(c => c.startsWith('refreshToken='));

beforeAll(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('registration and login', () => {
  it('registers with the browser time zone and never returns secrets', async () => {
    const { user } = await registerUser(app, { timezone: 'Asia/Colombo' });
    expect(user.timezone).toBe('Asia/Colombo');
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('tokenVersion');
  });

  it('rejects an invalid time zone with a field-level 400', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: 'tz@example.test', username: 'tzuser', password: 'correct-horse-9', timezone: 'Mars/Olympus' });
    expect(res.status).toBe(400);
    expect(res.body.validationErrors[0].field).toBe('timezone');
  });

  it('answers the same for an unknown email and a wrong password', async () => {
    const { email } = await registerUser(app);
    const wrongPassword = await request(app).post('/api/auth/login').send({ email, password: 'nope-nope-nope' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.test', password: 'nope-nope-nope' });
    expect(wrongPassword.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknown.body.error);
  });
});

describe('tokens', () => {
  it('issues 15-minute, versioned access tokens', async () => {
    const { token } = await registerUser(app);
    const claims = jwt.decode(token) as jwt.JwtPayload;
    expect(claims.exp! - claims.iat!).toBe(900);
    expect(claims.ver).toBe(0);
    expect(claims.type).toBe('access');
  });

  it('sets the refresh cookie httpOnly, scoped to /api/auth, for 30 days', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: 'cookie@example.test', username: 'cookieuser', password: 'correct-horse-9' });
    const cookie = cookieOf(res)!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(/Max-Age=2592000/);
  });

  it('refresh returns the user and rotates the refresh cookie', async () => {
    const { refreshCookie, email } = await registerUser(app);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(cookieOf(res)!.split(';')[0]).not.toBe(refreshCookie);
  });

  it('never accepts one token type in place of the other', async () => {
    const { token, refreshCookie } = await registerUser(app);
    const refreshValue = refreshCookie.split('=')[1];
    expect((await request(app).get('/api/auth/me').set(auth(refreshValue))).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${token}`)).status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const { token } = await registerUser(app);
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa');
    expect((await request(app).get('/api/auth/me').set(auth(tampered))).status).toBe(401);
  });
});

describe('sign out', () => {
  it('logout works without an access token and clears the cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(cookieOf(res)).toMatch(/^refreshToken=;/);
  });

  it('logout-all revokes every existing token of that user only', async () => {
    const alice = await registerUser(app);
    const bob = await registerUser(app);
    expect((await request(app).post('/api/auth/logout-all').set(auth(alice.token))).status).toBe(200);

    const me = await request(app).get('/api/auth/me').set(auth(alice.token));
    expect(me.status).toBe(401);
    expect(me.body.error).toBe('Session revoked.');
    expect((await request(app).post('/api/auth/refresh').set('Cookie', alice.refreshCookie)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(auth(bob.token))).status).toBe(200);

    const relogin = await request(app).post('/api/auth/login').send({ email: alice.email, password: alice.password });
    expect((jwt.decode(relogin.body.data.accessToken) as jwt.JwtPayload).ver).toBe(1);
  });
});
