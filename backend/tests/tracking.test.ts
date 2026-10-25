import request from 'supertest';
import { app } from '../src/app';
import { dateKeyInZone } from '../src/utils/dates';
import { auth, prisma, registerUser, resetDatabase } from './helpers';

// Schedules, habits, reflections, focus sessions and the analytics built on them.
let token: string;
const TZ = 'Asia/Colombo';
const today = () => dateKeyInZone(new Date(), TZ);
const at = (day: number, h: number) => new Date(Date.UTC(2026, 10, day, h)).toISOString();

beforeAll(async () => {
  await resetDatabase();
  token = (await registerUser(app, { timezone: TZ })).token;
});
afterAll(() => prisma.$disconnect());

describe('schedules', () => {
  it('bulk-creates up to 200 blocks in one request', async () => {
    const schedules = [2, 3, 4].map(d => ({ title: 'Deep work', startTime: at(d, 9), endTime: at(d, 10) }));
    const res = await request(app).post('/api/schedules/bulk').set(auth(token)).send({ schedules });
    expect(res.status).toBe(201);
    expect(res.body.data.count).toBe(3);
    const tooMany = Array.from({ length: 201 }, () => schedules[0]);
    expect((await request(app).post('/api/schedules/bulk').set(auth(token)).send({ schedules: tooMany })).status).toBe(400);
  });

  it('validates the listing range (400, not 500)', async () => {
    expect((await request(app).get('/api/schedules?startDate=not-a-date').set(auth(token))).status).toBe(400);
  });
});

describe('habits', () => {
  it('lists habits with their recent completions in one request', async () => {
    const { habit } = (await request(app).post('/api/habits').set(auth(token)).send({ name: 'Read', frequency: 'DAILY' })).body.data;
    await request(app).post(`/api/habits/${habit.id}/complete`).set(auth(token)).send({ date: today() });
    const [listed] = (await request(app).get('/api/habits').set(auth(token))).body.data.habits;
    expect(listed.completions).toHaveLength(1);
    expect(listed.completions[0].date.startsWith(today())).toBe(true);
  });
});

describe('reflections', () => {
  it('saves one review per day in the user\'s time zone and updates it in place', async () => {
    const first = await request(app).put(`/api/reflections/${today()}`).set(auth(token)).send({ performance: 4, energy: 3, mood: 5 });
    expect(first.body.data.reflection.date).toBe(today());
    const second = await request(app).put(`/api/reflections/${today()}`).set(auth(token)).send({ performance: 2, energy: null, mood: 3 });
    expect(second.body.data.reflection).toMatchObject({ performance: 2, energy: null });
  });

  it('rejects future days and out-of-range ratings', async () => {
    expect((await request(app).put('/api/reflections/2099-01-01').set(auth(token)).send({ mood: 3 })).status).toBe(400);
    expect((await request(app).put(`/api/reflections/${today()}`).set(auth(token)).send({ mood: 9 })).status).toBe(400);
  });

  it('imports local reviews without overwriting existing days', async () => {
    const res = await request(app).post('/api/reflections/import').set(auth(token)).send({ reflections: [
      { date: today(), performance: 5, notes: 'stale local copy' },
      { date: '2026-10-01', performance: 3, notes: 'from localStorage' },
      { date: '2026-10-02', performance: null, energy: null, mood: null, notes: '' },
    ] });
    expect(res.body.data.imported).toBe(1);
    const list = (await request(app).get('/api/reflections').set(auth(token))).body.data.reflections;
    expect(list.find((r: { date: string }) => r.date === today()).performance).toBe(2);
  });
});

describe('focus sessions', () => {
  it('inherits goal/task from a planned block and adds to the task\'s logged time', async () => {
    const goal = (await request(app).post('/api/goals').set(auth(token)).send({ title: 'Ship' })).body.data.goal;
    const task = (await request(app).post('/api/tasks').set(auth(token)).send({ title: 'README', goalId: goal.id })).body.data.task;
    const block = (await request(app).post('/api/schedules').set(auth(token))
      .send({ title: 'Write', startTime: at(9, 9), endTime: at(9, 10), goalId: goal.id, taskId: task.id })).body.data.schedule;
    const end = new Date(), start = new Date(end.getTime() - 25 * 60_000);
    const res = await request(app).post('/api/focus-sessions').set(auth(token)).send({
      startedAt: start.toISOString(), endedAt: end.toISOString(), durationSeconds: 1500, plannedSeconds: 1500, completed: true, scheduleId: block.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.session).toMatchObject({ scheduleId: block.id, goalId: goal.id, taskId: task.id });
    expect((await request(app).get(`/api/tasks/${task.id}`).set(auth(token))).body.data.task.actualTime).toBe(25);
  });

  it('rejects sessions that end before they start', async () => {
    const now = new Date();
    const res = await request(app).post('/api/focus-sessions').set(auth(token)).send({
      startedAt: now.toISOString(), endedAt: new Date(now.getTime() - 60_000).toISOString(), durationSeconds: 60, plannedSeconds: 60, completed: false,
    });
    expect(res.status).toBe(400);
  });
});

describe('analytics overview', () => {
  it('reports habits, focus and review stats for the user\'s calendar range', async () => {
    const res = await request(app).get('/api/analytics/overview').set(auth(token));
    const a = res.body.data.analytics;
    expect(a.period).toMatchObject({ endDate: today(), timezone: TZ });
    expect(a.habits).toMatchObject({ total: 1, completionRate: 100 });
    expect(a.focus).toMatchObject({ sessions: 1, totalMinutes: 25, completionRate: 100 });
    expect(a.reflections.averageMood).toBe(3);
  });

  it('returns an empty time allocation (no NaN) for a new user and rejects reversed ranges', async () => {
    const fresh = (await registerUser(app)).token;
    expect((await request(app).get('/api/analytics/time-allocation').set(auth(fresh))).body.data.timeAllocation).toEqual([]);
    expect((await request(app).get('/api/analytics/overview?startDate=2026-10-20&endDate=2026-10-01').set(auth(fresh))).status).toBe(400);
  });
});
