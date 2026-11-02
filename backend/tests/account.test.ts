import { createHash } from 'crypto';
import request from 'supertest';
import { app } from '../src/app';
import { MailMessage, passwordResetEmail, setMailerForTests } from '../src/services/mail';
import { auth, prisma, registerUser, resetDatabase, TestUser } from './helpers';

const sent: MailMessage[] = [];
const cookieOf = (res: request.Response) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find(c => c.startsWith('refreshToken='))?.split(';')[0];
const login = (email: string, password: string) => request(app).post('/api/auth/login').send({ email, password });
const linkToken = (message: MailMessage) => /reset-password\?token=([\w-]+)/.exec(message.text)![1];

async function waitFor(check: () => boolean | Promise<boolean>) {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > 5000) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, 20));
  }
}

beforeAll(async () => {
  await resetDatabase();
  setMailerForTests({ send: async m => { sent.push(m); } });
});
beforeEach(() => { sent.length = 0; });
afterAll(async () => {
  setMailerForTests(undefined);
  await prisma.$disconnect();
});

describe('change password', () => {
  let user: TestUser;
  beforeAll(async () => { user = await registerUser(app); });
  const change = (body: object, token = user.token) => request(app).put('/api/auth/password').set(auth(token)).send(body);

  it('needs the right current password, and a new one that is different and long enough', async () => {
    const wrong = await change({ currentPassword: 'not-it', newPassword: 'brand-new-pass-1' });
    expect(wrong.status).toBe(400); // not 401, which the app treats as "signed out"
    expect(wrong.body.error).toBe('Your current password is incorrect.');
    expect((await change({ currentPassword: user.password, newPassword: user.password })).body.error).toMatch(/different/);
    expect((await change({ currentPassword: user.password, newPassword: 'short' })).status).toBe(400);
  });

  it('signs out other devices and keeps this one signed in', async () => {
    const otherDevice = await login(user.email, user.password);
    const res = await change({ currentPassword: user.password, newPassword: 'brand-new-pass-1' });
    expect(res.status).toBe(200);
    expect(cookieOf(res)).toBeDefined();

    expect((await request(app).get('/api/auth/me').set(auth(res.body.data.accessToken))).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(auth(otherDevice.body.data.accessToken))).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookieOf(otherDevice)!)).status).toBe(401);
    expect((await login(user.email, user.password)).status).toBe(401);
    expect((await login(user.email, 'brand-new-pass-1')).status).toBe(200);
  });
});

describe('forgot and reset password', () => {
  let user: TestUser;
  beforeAll(async () => { user = await registerUser(app, { firstName: 'Ada' }); });
  const forgot = (email: string) => request(app).post('/api/auth/password/forgot').send({ email });
  const reset = (token: string, newPassword = 'reset-pass-123') => request(app).post('/api/auth/password/reset').send({ token, newPassword });

  it('answers the same for unknown emails and sends nothing', async () => {
    const res = await forgot('nobody@example.test');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('If an account uses that email, a reset link is on its way.');
    await new Promise(r => setTimeout(r, 200));
    expect(sent).toHaveLength(0);
  });

  it('emails a single-use link and stores only its hash', async () => {
    const res = await forgot(user.email.toUpperCase()); // case doesn't matter
    expect(res.body.message).toBe('If an account uses that email, a reset link is on its way.');
    await waitFor(() => sent.length === 1);
    const [mail] = sent;
    expect(mail).toMatchObject({ to: user.email, subject: 'Reset your GrowthTracker password' });
    expect(mail.text).toContain('Hi Ada,');
    expect(mail.text).toContain('http://localhost:3000/reset-password?token=');

    const token = linkToken(mail);
    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.user.id } });
    expect(stored.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it('sends at most one email a minute per account', async () => {
    await forgot(user.email);
    await new Promise(r => setTimeout(r, 300));
    expect(sent).toHaveLength(0);
  });

  it('resets the password, signs in here and out everywhere else, and works only once', async () => {
    const before = await login(user.email, user.password);
    const token = linkToken((await prisma.passwordResetToken.deleteMany(), await forgot(user.email), await waitFor(() => sent.length === 1), sent[0]));

    const res = await reset(token);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
    expect(cookieOf(res)).toBeDefined();
    expect((await request(app).get('/api/auth/me').set(auth(before.body.data.accessToken))).status).toBe(401);
    expect((await login(user.email, 'reset-pass-123')).status).toBe(200);

    const again = await reset(token, 'another-pass-456');
    expect(again.status).toBe(400);
    expect(again.body.error).toBe('This reset link is invalid or has expired. Request a new one.');
  });

  it('rejects expired and made-up links', async () => {
    await prisma.passwordResetToken.deleteMany();
    await forgot(user.email);
    await waitFor(() => sent.length === 1);
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await reset(linkToken(sent[0]))).status).toBe(400);
    expect((await reset('x'.repeat(43))).status).toBe(400);
  });

  it('never resets the shared demo account', async () => {
    const { seedDemo, DEMO_EMAIL } = await import('../src/scripts/seed');
    await seedDemo();
    expect((await forgot(DEMO_EMAIL)).status).toBe(200);
    await new Promise(r => setTimeout(r, 200));
    expect(sent).toHaveLength(0);
    const demo = await login(DEMO_EMAIL, 'demo-password-1');
    const change = await request(app).put('/api/auth/password').set(auth(demo.body.data.accessToken))
      .send({ currentPassword: 'demo-password-1', newPassword: 'hijacked-123' });
    expect(change.status).toBe(403);
  });
});

describe('export and delete', () => {
  let user: TestUser;
  beforeAll(async () => {
    user = await registerUser(app);
    const goal = (await request(app).post('/api/goals').set(auth(user.token)).send({ title: 'Mine' })).body.data.goal;
    await request(app).post('/api/tasks').set(auth(user.token)).send({ title: 'My task', goalId: goal.id, subtasks: [{ title: 'step' }] });
    await request(app).post('/api/habits').set(auth(user.token)).send({ name: 'Read', frequency: 'DAILY' });
    await prisma.aiUsage.create({ data: { userId: user.user.id, model: 'm', status: 'ok', feature: 'coach' } });
    const other = await registerUser(app);
    await request(app).post('/api/goals').set(auth(other.token)).send({ title: 'Not mine' });
  });

  it('exports everything of the user, and nothing of anyone else or any credential', async () => {
    const res = await request(app).get('/api/users/me/export').set(auth(user.token));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="growthtracker-export-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.body).toMatchObject({ exportVersion: 1, account: { email: user.email } });
    expect(res.body.goals.map((g: { title: string }) => g.title)).toEqual(['Mine']);
    expect(res.body.tasks[0]).toMatchObject({ title: 'My task', subtasks: [expect.objectContaining({ title: 'step' })] });
    expect(res.body.habits).toHaveLength(1);
    expect(res.body.aiUsage).toHaveLength(1);
    expect(res.text).not.toMatch(/password|tokenVersion|\$2[ab]\$/);
  });

  it('needs the password to delete, then removes everything', async () => {
    const del = (password: string) => request(app).delete('/api/auth/account').set(auth(user.token)).send({ password });
    const wrong = await del('nope');
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe('That password is incorrect.');

    const res = await del(user.password);
    expect(res.status).toBe(200);
    expect(([] as string[]).concat(res.headers['set-cookie'] ?? []).some(c => /^refreshToken=;/.test(c))).toBe(true);

    expect(await prisma.user.count({ where: { id: user.user.id } })).toBe(0);
    expect(await prisma.goal.count({ where: { title: 'Mine' } })).toBe(0);
    expect(await prisma.task.count({ where: { title: 'My task' } })).toBe(0);
    expect(await prisma.subtask.count({ where: { title: 'step' } })).toBe(0);
    expect(await prisma.goal.count({ where: { title: 'Not mine' } })).toBe(1);
    // Usage counts stay for the global AI cap, but no longer point at anyone.
    expect(await prisma.aiUsage.findFirst({ where: { model: 'm' } })).toMatchObject({ userId: null });
    expect((await request(app).get('/api/auth/me').set(auth(user.token))).status).toBe(401);
    expect((await login(user.email, user.password)).status).toBe(401);
  });

  it('won\'t delete the shared demo account', async () => {
    const { DEMO_EMAIL } = await import('../src/scripts/seed');
    const demo = await login(DEMO_EMAIL, 'demo-password-1');
    const res = await request(app).delete('/api/auth/account').set(auth(demo.body.data.accessToken)).send({ password: 'demo-password-1' });
    expect(res.status).toBe(403);
  });
});

it('the reset email escapes anything that could be HTML', () => {
  const mail = passwordResetEmail('a@b.test', '<script>x</script>', 'https://app.test/reset-password?token=abc&x="1"', 30);
  expect(mail.html).not.toContain('<script>');
  expect(mail.html).toContain('&lt;script&gt;');
  expect(mail.html).toContain('token=abc&amp;x=&quot;1&quot;');
  expect(mail.text).toContain('expires in 30 minutes');
});
