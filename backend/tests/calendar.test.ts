import request from 'supertest';
import ICAL from 'ical.js';
import { app } from '../src/app';
import { DEMO_EMAIL } from '../src/config/demo';
import { buildCalendar, escapeText, foldLine } from '../src/services/calendarFeed';
import { logger } from '../src/utils/logger';
import { addDays, dateKeyInZone } from '../src/utils/dates';
import { auth, prisma, registerUser, resetDatabase, TestUser } from './helpers';

const enable = async (token: string) => (await request(app).post('/api/calendar').set(auth(token))).body.data.token as string;
const feed = (token: string) => request(app).get(`/calendar/${token}.ics`);

const eventsIn = (text: string) =>
  new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent').map(item => new ICAL.Event(item));

const inDays = (days: number, hour = 9) => {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};

beforeAll(resetDatabase);
afterAll(() => prisma.$disconnect());
afterEach(() => jest.restoreAllMocks());

describe('the feed link', () => {
  let user: TestUser;
  beforeEach(async () => { user = await registerUser(app); });

  it('is off until the user turns it on', async () => {
    const res = await request(app).get('/api/calendar').set(auth(user.token));
    expect(res.body.data.token).toBeNull();
  });

  it('works without signing in, and can be read again in Settings', async () => {
    const token = await enable(user.token);
    expect(token).toHaveLength(43);
    expect((await feed(token)).status).toBe(200);
    expect((await request(app).get('/api/calendar').set(auth(user.token))).body.data.token).toBe(token);
  });

  it('stops working when replaced', async () => {
    const old = await enable(user.token);
    const fresh = await enable(user.token);
    expect(fresh).not.toBe(old);
    expect((await feed(old)).status).toBe(404);
    expect((await feed(fresh)).status).toBe(200);
  });

  it('stops working when turned off', async () => {
    const token = await enable(user.token);
    await request(app).delete('/api/calendar').set(auth(user.token));
    expect((await feed(token)).status).toBe(404);
  });

  it('stops working on sign out everywhere', async () => {
    const token = await enable(user.token);
    await request(app).post('/api/auth/logout-all').set(auth(user.token));
    expect((await feed(token)).status).toBe(404);
  });

  it('stops working on a password change', async () => {
    const token = await enable(user.token);
    await request(app).put('/api/auth/password').set(auth(user.token)).send({ currentPassword: user.password, newPassword: 'a-brand-new-password' });
    expect((await feed(token)).status).toBe(404);
  });

  it('stops working when the account is deleted', async () => {
    const token = await enable(user.token);
    await request(app).delete('/api/auth/account').set(auth(user.token)).send({ password: user.password });
    expect((await feed(token)).status).toBe(404);
  });

  it('rejects guesses, in the same way', async () => {
    for (const guess of ['x'.repeat(43), 'short', '../../etc/passwd', `${'x'.repeat(43)}.txt`]) {
      const res = await request(app).get(`/calendar/${guess}${guess.includes('.') ? '' : '.ics'}`);
      expect(res.status).toBe(404);
    }
  });

  it('is left out of the data export', async () => {
    const token = await enable(user.token);
    const res = await request(app).get('/api/users/me/export').set(auth(user.token));
    expect(JSON.stringify(res.body)).not.toContain(token);
  });

  it('needs a signed-in user to manage', async () => {
    expect((await request(app).post('/api/calendar')).status).toBe(401);
  });

  it('isn’t available on the shared demo account', async () => {
    const demo = await registerUser(app, { email: DEMO_EMAIL });
    expect((await request(app).post('/api/calendar').set(auth(demo.token))).status).toBe(403);
    await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
  });

  it('never appears in the logs', async () => {
    const log = jest.spyOn(logger, 'info');
    const token = await enable(user.token);
    await feed(token);
    await new Promise(resolve => setTimeout(resolve, 20));
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain('/calendar/[hidden]');
    expect(logged).not.toContain(token);
  });
});

describe('what’s in the feed', () => {
  let user: TestUser;
  let token: string;
  beforeEach(async () => {
    user = await registerUser(app, { timezone: 'Asia/Colombo' });
    token = await enable(user.token);
  });

  const block = (title: string, days: number, extra: object = {}) => prisma.schedule.create({
    data: { userId: user.user.id, title, startTime: inDays(days), endTime: inDays(days, 10), ...extra },
  });

  it('is served as a calendar', async () => {
    const res = await feed(token);
    expect(res.headers['content-type']).toBe('text/calendar; charset=utf-8');
    expect(res.text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(res.text.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('has time blocks at the right moment, in a form calendar software reads', async () => {
    const goal = await prisma.goal.create({ data: { userId: user.user.id, title: 'AWS exam' } });
    const saved = await block('Study, then review; part 2', 1, { goalId: goal.id });

    const [event] = eventsIn((await feed(token)).text);

    expect(event.summary).toBe('Study, then review; part 2');
    expect(event.description).toBe('Goal: AWS exam');
    expect(event.uid).toBe(`block-${saved.id}@growthtracker`);
    expect(event.startDate.toJSDate().toISOString()).toBe(saved.startTime.toISOString());
    expect(event.endDate.toJSDate().toISOString()).toBe(saved.endTime.toISOString());
  });

  it('shows all-day blocks on the user’s own calendar day', async () => {
    // 20:00 UTC is already the next day in Colombo.
    const start = inDays(2, 20);
    await prisma.schedule.create({ data: { userId: user.user.id, title: 'Trip', startTime: start, endTime: start, allDay: true } });
    const [event] = eventsIn((await feed(token)).text);
    expect(event.startDate.isDate).toBe(true);
    expect(event.startDate.toString()).toBe(dateKeyInZone(start, 'Asia/Colombo'));
    expect(event.endDate.toString()).toBe(addDays(dateKeyInZone(start, 'Asia/Colombo'), 1));
  });

  it('shows open tasks with a due date as all-day deadlines', async () => {
    const due = new Date(`${addDays(dateKeyInZone(new Date(), 'Asia/Colombo'), 3)}T00:00:00.000Z`);
    await prisma.task.create({ data: { userId: user.user.id, title: 'Submit report', dueDate: due } });
    await prisma.task.create({ data: { userId: user.user.id, title: 'No date' } });
    await prisma.task.create({ data: { userId: user.user.id, title: 'Already done', dueDate: due, status: 'COMPLETED' } });

    const events = eventsIn((await feed(token)).text);

    expect(events.map(e => e.summary)).toEqual(['Due: Submit report']);
    expect(events[0].startDate.toString()).toBe(due.toISOString().slice(0, 10));
  });

  it('leaves out skipped blocks and anything far from today', async () => {
    await block('Skipped', 1, { status: 'SKIPPED' });
    await block('Rescheduled', 1, { status: 'RESCHEDULED' });
    await block('Long gone', -60);
    await block('Far away', 400);
    await block('Kept', 1);
    expect(eventsIn((await feed(token)).text).map(e => e.summary)).toEqual(['Kept']);
  });

  it('contains nobody else’s plan', async () => {
    const other = await registerUser(app);
    await prisma.schedule.create({ data: { userId: other.user.id, title: 'Someone else', startTime: inDays(1), endTime: inDays(1, 10) } });
    expect((await feed(token)).text).not.toContain('Someone else');
  });
});

describe('writing iCalendar', () => {
  const options = { appUrl: 'https://app.example', dayOf: () => '2026-11-09' };
  const when = new Date('2026-11-09T10:00:00Z');
  const block = { id: 'b1', startTime: when, endTime: when, allDay: false, updatedAt: when, goal: null };

  it('escapes what would otherwise be read as syntax', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('can’t be tricked into adding fields by a title with line breaks', () => {
    const text = buildCalendar([{ ...block, title: 'Run\r\nATTENDEE:mailto:someone@example.com' }], [], options);
    expect(text).not.toMatch(/^ATTENDEE/m);
    expect(eventsIn(text)[0].summary).toBe('Run\nATTENDEE:mailto:someone@example.com');
  });

  it('keeps every line within 75 bytes, without splitting a character', () => {
    const title = 'Plan වැඩ සටහන 📅 '.repeat(12);
    const text = buildCalendar([{ ...block, title }], [], options);
    for (const line of text.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(text).not.toContain('�');
    expect(eventsIn(text)[0].summary).toBe(title);
  });

  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:Run')).toBe('SUMMARY:Run');
  });
});
