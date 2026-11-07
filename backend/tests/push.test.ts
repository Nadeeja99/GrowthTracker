import './push-env'; // must stay the first import
import request from 'supertest';
import webpush from 'web-push';
import { app } from '../src/app';
import { DEMO_EMAIL } from '../src/config/demo';
import { buildDigest, isDigestDue, runDigests } from '../src/services/digests';
import { PushMessage, PushTarget, setPushSenderForTests } from '../src/services/push';
import { auth, prisma, registerUser, resetDatabase } from './helpers';

const device = (name = 'phone') => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${name}`,
  keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-key' },
});

let sent: Array<{ target: PushTarget; message: PushMessage }>;
let refuse: ((target: PushTarget) => number | undefined) | undefined;

const subscribe = (token: string, body: object = device()) =>
  request(app).post('/api/push/subscriptions').set(auth(token)).send(body);

/** A signed-up user in Colombo with digests on and one device. */
async function digestUser(name = 'phone') {
  const user = await registerUser(app, { timezone: 'Asia/Colombo' });
  await subscribe(user.token, device(`${name}-${user.user.id}`));
  await prisma.user.update({ where: { id: user.user.id }, data: { morningDigestAt: '07:00', eveningDigestAt: '20:00' } });
  return user;
}

// 07:30 and 20:00 in Colombo (UTC+5:30).
const COLOMBO_MORNING = new Date('2026-11-09T02:00:00Z');
const COLOMBO_EVENING = new Date('2026-11-09T14:30:00Z');

beforeAll(resetDatabase);
afterAll(() => prisma.$disconnect());
beforeEach(() => {
  sent = [];
  refuse = undefined;
  setPushSenderForTests(async (target, message) => {
    const status = refuse?.(target);
    if (status) throw Object.assign(new Error('refused'), { statusCode: status });
    sent.push({ target, message });
  });
});
afterEach(async () => {
  setPushSenderForTests(undefined);
  await prisma.digestDelivery.deleteMany();
  await prisma.pushSubscription.deleteMany();
});

describe('device registration', () => {
  it('tells the app the public key, and never the private one', async () => {
    const { token } = await registerUser(app);
    const res = await request(app).get('/api/push/settings').set(auth(token));
    expect(res.body.data).toEqual({ available: true, publicKey: process.env.VAPID_PUBLIC_KEY, morning: null, evening: null });
    expect(JSON.stringify(res.body)).not.toContain(process.env.VAPID_PRIVATE_KEY);
  });

  it('accepts the real push services', async () => {
    const { token } = await registerUser(app);
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://web.push.apple.com/QAbc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) {
      expect((await subscribe(token, { ...device(), endpoint })).status).toBe(201);
    }
  });

  it('refuses any other address, so the server can’t be aimed at one', async () => {
    const { token } = await registerUser(app);
    for (const endpoint of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://fcm.googleapis.com:8443/fcm/send/abc',
      'https://fcm.googleapis.com.attacker.example/abc',
      'https://attacker.example/push.apple.com',
      'https://localhost/abc',
      'https://169.254.169.254/latest/meta-data',
      'not a url',
    ]) {
      expect((await subscribe(token, { ...device(), endpoint })).status).toBe(400);
    }
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('moves a device to whoever signed in on it last', async () => {
    const first = await registerUser(app);
    const second = await registerUser(app);
    await subscribe(first.token);
    await subscribe(second.token);
    const rows = await prisma.pushSubscription.findMany();
    expect(rows.map(r => r.userId)).toEqual([second.user.id]);
  });

  it('only removes your own devices', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    await subscribe(owner.token);
    await request(app).delete('/api/push/subscriptions').set(auth(other.token)).send({ endpoint: device().endpoint });
    expect(await prisma.pushSubscription.count()).toBe(1);
    await request(app).delete('/api/push/subscriptions').set(auth(owner.token)).send({ endpoint: device().endpoint });
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('keeps the newest ten devices', async () => {
    const { token, user } = await registerUser(app);
    for (let i = 0; i < 12; i++) await subscribe(token, device(`phone-${i}`));
    expect(await prisma.pushSubscription.count({ where: { userId: user.id } })).toBe(10);
  });

  it('needs a signed-in user', async () => {
    expect((await request(app).post('/api/push/subscriptions').send(device())).status).toBe(401);
  });

  it('is off for the shared demo account', async () => {
    const { token } = await registerUser(app, { email: DEMO_EMAIL });
    expect((await request(app).get('/api/push/settings').set(auth(token))).body.data.available).toBe(false);
    expect((await subscribe(token)).status).toBe(403);
    await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
  });
});

describe('losing access stops notifications', () => {
  it('removes every device on sign out everywhere', async () => {
    const { token } = await registerUser(app);
    await subscribe(token);
    await request(app).post('/api/auth/logout-all').set(auth(token));
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('removes every device on a password change', async () => {
    const { token, password } = await registerUser(app);
    await subscribe(token);
    await request(app).put('/api/auth/password').set(auth(token)).send({ currentPassword: password, newPassword: 'a-brand-new-password' });
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('removes devices with the account', async () => {
    const { token, password } = await registerUser(app);
    await subscribe(token);
    await request(app).delete('/api/auth/account').set(auth(token)).send({ password });
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('leaves the device’s endpoint out of the data export', async () => {
    const { token } = await registerUser(app);
    await subscribe(token);
    await request(app).put('/api/push/settings').set(auth(token)).send({ morning: '07:00', evening: null });
    const res = await request(app).get('/api/users/me/export').set(auth(token));
    expect(res.body.account.morningDigestAt).toBe('07:00');
    expect(JSON.stringify(res.body)).not.toContain(device().endpoint);
  });
});

describe('sending', () => {
  it('sends a test notification to the user’s devices', async () => {
    const { token } = await registerUser(app);
    await subscribe(token);
    const res = await request(app).post('/api/push/test').set(auth(token));
    expect(res.status).toBe(200);
    expect(sent[0].message.title).toBe('Notifications are on');
  });

  it('says so when nothing reached a device', async () => {
    const { token } = await registerUser(app);
    expect((await request(app).post('/api/push/test').set(auth(token))).status).toBe(502);
  });

  it('forgets a device the push service says is gone', async () => {
    const { token } = await registerUser(app);
    await subscribe(token, device('gone'));
    await subscribe(token, device('here'));
    refuse = target => (target.endpoint.endsWith('gone') ? 410 : undefined);
    await request(app).post('/api/push/test').set(auth(token));
    const rows = await prisma.pushSubscription.findMany();
    expect(rows.map(r => r.endpoint)).toEqual([device('here').endpoint]);
  });

  it('keeps a device through a temporary failure', async () => {
    const { token } = await registerUser(app);
    await subscribe(token);
    refuse = () => 500;
    expect((await request(app).post('/api/push/test').set(auth(token))).status).toBe(502);
    expect(await prisma.pushSubscription.count()).toBe(1);
  });

  it('builds a valid encrypted request with the configured keys', () => {
    const { publicKey } = webpush.generateVAPIDKeys();
    const client = { endpoint: device().endpoint, keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } };
    const details = webpush.generateRequestDetails(client, 'hello', {
      vapidDetails: { subject: 'https://growthtracker.example', publicKey: process.env.VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY! },
    });
    expect(details.headers['Content-Encoding']).toBe('aes128gcm');
    expect(String(details.headers.Authorization)).toContain(process.env.VAPID_PUBLIC_KEY);
    expect(publicKey).not.toBe(process.env.VAPID_PUBLIC_KEY);
  });
});

describe('digest settings', () => {
  it('saves times on the half hour, and null for off', async () => {
    const { token, user } = await registerUser(app);
    const res = await request(app).put('/api/push/settings').set(auth(token)).send({ morning: '06:30', evening: null });
    expect(res.status).toBe(200);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect([saved.morningDigestAt, saved.eveningDigestAt]).toEqual(['06:30', null]);
  });

  it('rejects other times', async () => {
    const { token } = await registerUser(app);
    for (const morning of ['7:00', '07:15', '24:00', 'noon']) {
      expect((await request(app).put('/api/push/settings').set(auth(token)).send({ morning, evening: null })).status).toBe(400);
    }
  });
});

describe('digest content', () => {
  const day = { blocks: [] as Array<{ title: string; time: string }>, tasksDue: 0, habitsLeft: [] as string[], reviewed: false };

  it('sums up the morning', () => {
    const message = buildDigest('morning', {
      ...day,
      blocks: [{ title: 'AWS study', time: '07:00' }, { title: 'Run', time: '18:00' }],
      tasksDue: 1,
      habitsLeft: ['Read', 'Stretch'],
    });
    expect(message).toMatchObject({ title: 'Your day ahead', url: '/today', tag: 'digest-morning' });
    expect(message!.body).toBe('2 time blocks, starting with AWS study at 07:00. 1 task due. 2 habits to do.');
  });

  it('sums up the evening', () => {
    const message = buildDigest('evening', { ...day, habitsLeft: ['Read', 'Stretch', 'Journal'] });
    expect(message!.body).toBe('3 habits left: Read, Stretch and more. Take a minute to review your day.');
  });

  it('stays quiet with nothing to say', () => {
    expect(buildDigest('morning', day)).toBeNull();
    expect(buildDigest('evening', { ...day, reviewed: true })).toBeNull();
  });
});

describe('digest timing', () => {
  it('is due from the chosen time, for two hours, in the user’s zone', () => {
    const at = (iso: string) => isDigestDue('07:00', new Date(iso), 'Asia/Colombo');
    expect(at('2026-11-09T01:29:00Z')).toBe(false); // 06:59
    expect(at('2026-11-09T01:30:00Z')).toBe(true); //  07:00
    expect(at('2026-11-09T03:29:00Z')).toBe(true); //  08:59
    expect(at('2026-11-09T03:30:00Z')).toBe(false); // 09:00
  });

  it('follows clock changes', () => {
    expect(isDigestDue('07:00', new Date('2026-07-01T06:00:00Z'), 'Europe/Dublin')).toBe(true); //  summer, UTC+1
    expect(isDigestDue('07:00', new Date('2026-12-01T06:00:00Z'), 'Europe/Dublin')).toBe(false); // winter, UTC
  });
});

describe('running digests', () => {
  it('sends the morning digest with today’s plan, in the user’s zone', async () => {
    const { user } = await digestUser();
    await prisma.schedule.create({
      data: { userId: user.id, title: 'AWS study', startTime: new Date('2026-11-09T02:30:00Z'), endTime: new Date('2026-11-09T03:30:00Z') },
    });
    await prisma.schedule.create({
      data: { userId: user.id, title: 'Tomorrow', startTime: new Date('2026-11-09T19:00:00Z'), endTime: new Date('2026-11-09T20:00:00Z') }, // 00:30 next day
    });

    await runDigests(COLOMBO_MORNING);

    expect(sent).toHaveLength(1);
    expect(sent[0].message.body).toBe('1 time block, starting with AWS study at 08:00.');
    await prisma.schedule.deleteMany({ where: { userId: user.id } });
  });

  it('only sends each digest once a day', async () => {
    const { user } = await digestUser();
    await prisma.habit.create({ data: { userId: user.id, name: 'Read', frequency: 'DAILY' } });
    await runDigests(COLOMBO_MORNING);
    await runDigests(new Date(COLOMBO_MORNING.getTime() + 30 * 60 * 1000));
    await Promise.all([runDigests(COLOMBO_MORNING), runDigests(COLOMBO_MORNING)]);
    expect(sent.filter(s => s.target.endpoint.includes(user.id))).toHaveLength(1);
  });

  it('counts only what’s still left in the evening', async () => {
    const { user } = await digestUser();
    const done = await prisma.habit.create({ data: { userId: user.id, name: 'Done', frequency: 'DAILY' } });
    await prisma.habit.create({ data: { userId: user.id, name: 'Left', frequency: 'DAILY' } });
    await prisma.habit.create({ data: { userId: user.id, name: 'Weekly', frequency: 'WEEKLY' } });
    await prisma.habitCompletion.create({ data: { habitId: done.id, date: new Date('2026-11-09') } });

    await runDigests(COLOMBO_EVENING);

    const mine = sent.find(s => s.target.endpoint.includes(user.id));
    expect(mine!.message.body).toBe('1 habit left: Left. Take a minute to review your day.');
  });

  it('sends nothing to someone with nothing planned in the morning', async () => {
    const { user } = await digestUser();
    await runDigests(COLOMBO_MORNING);
    expect(sent.filter(s => s.target.endpoint.includes(user.id))).toHaveLength(0);
  });

  it('skips digests the user turned off', async () => {
    const { user } = await digestUser();
    await prisma.habit.create({ data: { userId: user.id, name: 'Read', frequency: 'DAILY' } });
    await prisma.user.update({ where: { id: user.id }, data: { morningDigestAt: null } });
    await runDigests(COLOMBO_MORNING);
    expect(sent.filter(s => s.target.endpoint.includes(user.id))).toHaveLength(0);
  });

  it('never mixes up two users’ plans', async () => {
    const mine = await digestUser('mine');
    const theirs = await digestUser('theirs');
    await prisma.habit.create({ data: { userId: theirs.user.id, name: 'Private habit', frequency: 'DAILY' } });
    await runDigests(COLOMBO_EVENING);
    const body = sent.find(s => s.target.endpoint.includes(mine.user.id))?.message.body ?? '';
    expect(body).not.toContain('Private habit');
  });

  it('tries again on the next run when delivery failed', async () => {
    const { user } = await digestUser();
    await prisma.habit.create({ data: { userId: user.id, name: 'Read', frequency: 'DAILY' } });
    refuse = target => (target.endpoint.includes(user.id) ? 503 : undefined);
    await runDigests(COLOMBO_MORNING);
    refuse = undefined;
    await runDigests(COLOMBO_MORNING);
    expect(sent.filter(s => s.target.endpoint.includes(user.id))).toHaveLength(1);
  });

  it('drops delivery records after a month', async () => {
    const { user } = await digestUser();
    await prisma.digestDelivery.create({
      data: { userId: user.id, kind: 'morning', date: new Date('2026-01-01'), createdAt: new Date('2026-01-01') },
    });
    await runDigests(COLOMBO_MORNING);
    expect(await prisma.digestDelivery.count({ where: { date: new Date('2026-01-01') } })).toBe(0);
  });
});

describe('the scheduled job', () => {
  it('needs the secret', async () => {
    expect((await request(app).post('/internal/digests/run')).status).toBe(401);
    expect((await request(app).post('/internal/digests/run').set('Authorization', 'Bearer wrong')).status).toBe(401);
  });

  it('runs with the secret', async () => {
    const res = await request(app).post('/internal/digests/run').set('Authorization', `Bearer ${process.env.DIGEST_CRON_SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ users: expect.any(Number), sent: expect.any(Number) });
  });
});
