import request from 'supertest';
import { app } from '../src/app';
import { bandOf, MODEL, Outcome, skipProbability } from '../src/services/skipRisk/risk';
import { auth, prisma, registerUser, resetDatabase, TestUser } from './helpers';

let user: TestUser;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const risk = (who: TestUser, query: Record<string, string> = {}) =>
  request(app).get('/api/skip-risk').query(query).set(auth(who.token));

/** A block `daysAgo` days back (negative: in the future), at `hour` UTC. */
async function addBlock(who: TestUser, daysAgo: number, hour: number, status: 'COMPLETED' | 'SKIPPED' | 'PENDING' | 'IN_PROGRESS' | 'RESCHEDULED', extra: { minutes?: number; createdAt?: Date; focus?: boolean; goalId?: string } = {}) {
  const day = new Date(Date.now() - daysAgo * DAY);
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour));
  const block = await prisma.schedule.create({
    data: {
      userId: who.user.id, title: 'Block', status, goalId: extra.goalId,
      startTime: start, endTime: new Date(start.getTime() + (extra.minutes ?? 60) * 60_000),
      ...(extra.createdAt && { createdAt: extra.createdAt }),
    },
  });
  if (extra.focus) {
    await prisma.focusSession.create({
      data: { userId: who.user.id, scheduleId: block.id, startedAt: start, endedAt: new Date(start.getTime() + 25 * 60_000), durationSeconds: 1500, plannedSeconds: 1500, completed: true },
    });
  }
  return block;
}

/** Someone who keeps morning blocks and misses evening ones. */
async function morningPerson(who: TestUser) {
  for (let d = 3; d < 3 + 10; d++) {
    await addBlock(who, d, 8, 'COMPLETED');
    await addBlock(who, d, 19, 'SKIPPED');
  }
}

beforeEach(async () => {
  await resetDatabase();
  user = await registerUser(app, { timezone: 'UTC' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/skip-risk', () => {
  it('needs a signed-in user', async () => {
    await request(app).get('/api/skip-risk').expect(401);
  });

  it.each([
    ['a start that is not a date', { startDate: 'tomorrow' }],
    ['an end before the start', { startDate: new Date(Date.now() + 2 * DAY).toISOString(), endDate: new Date(Date.now() + DAY).toISOString() }],
    ['more than a month', { endDate: new Date(Date.now() + 40 * DAY).toISOString() }],
  ])('rejects %s', async (_name, query) => {
    await risk(user, query).expect(400);
  });

  it('says nothing until there is enough history', async () => {
    for (let d = 3; d < 3 + MODEL.minHistory - 1; d++) await addBlock(user, d, 8, 'COMPLETED');
    await addBlock(user, -1, 19, 'PENDING');
    const { data } = (await risk(user).expect(200)).body;
    expect(data).toMatchObject({ risks: [], history: MODEL.minHistory - 1, minHistory: MODEL.minHistory, threshold: MODEL.threshold });
  });

  it('flags a block at a time the person usually misses, with reasons, and not one they keep', async () => {
    await morningPerson(user);
    const evening = await addBlock(user, -1, 19, 'PENDING');
    const morning = await addBlock(user, -1, 8, 'PENDING');
    const { data } = (await risk(user).expect(200)).body;
    expect(data.history).toBe(20);
    const byId = Object.fromEntries(data.risks.map((r: { id: string }) => [r.id, r]));
    expect(byId[evening.id]).toMatchObject({ likelyToSlip: true });
    expect(byId[evening.id].reasons[0]).toBe('You often miss evening blocks');
    expect(byId[morning.id]).toMatchObject({ likelyToSlip: false, reasons: [] });
    expect(byId[evening.id].probability).toBeGreaterThan(byId[morning.id].probability);
  });

  it('feeds the model the same block details the Python side trained on', async () => {
    await morningPerson(user);
    const createdAt = new Date(Date.now() - 3 * DAY);
    const target = await addBlock(user, -2, 13, 'PENDING', { minutes: 90, createdAt });
    await addBlock(user, -2, 16, 'PENDING'); // a second block that day
    const { data } = (await risk(user).expect(200)).body;

    const history: Outcome[] = [];
    for (let d = 3; d < 13; d++) history.push({ band: 'evening', goalId: null, missed: true }, { band: 'morning', goalId: null, missed: false });
    const start = target.startTime;
    const expected = skipProbability(MODEL, {
      startMinutes: start.getUTCHours() * 60 + start.getUTCMinutes(),
      weekday: start.getUTCDay(),
      durationMinutes: 90,
      leadHours: (start.getTime() - createdAt.getTime()) / HOUR,
      dayLoad: 1,
      goalId: null,
    }, history);
    expect(data.risks.find((r: { id: string }) => r.id === target.id).probability).toBe(Math.round(expected * 100) / 100);
    expect(bandOf(MODEL, 13 * 60)).toBe('afternoon');
  });

  it('learns only from blocks with a known result that ended over a day ago', async () => {
    for (let d = 3; d < 3 + MODEL.minHistory - 1; d++) await addBlock(user, d, 8, 'COMPLETED');
    await addBlock(user, 5, 10, 'PENDING');                   // never ticked: unknown, left out
    await addBlock(user, 5, 12, 'IN_PROGRESS');               // same
    await addBlock(user, 5, 14, 'RESCHEDULED');               // moved, not missed
    await addBlock(user, 0.2, 8, 'SKIPPED');                  // too recent to count
    let { data } = (await risk(user).expect(200)).body;
    expect(data.history).toBe(MODEL.minHistory - 1);

    await addBlock(user, 6, 10, 'PENDING', { focus: true });  // worked on: kept
    ({ data } = (await risk(user).expect(200)).body);
    expect(data.history).toBe(MODEL.minHistory);
  });

  it('never uses another person’s blocks', async () => {
    const other = await registerUser(app, { timezone: 'UTC' });
    await morningPerson(other);
    await addBlock(user, -1, 19, 'PENDING');
    const { data } = (await risk(user).expect(200)).body;
    expect(data.history).toBe(0);
    expect(data.risks).toEqual([]);
  });

  it('only rates upcoming pending blocks in the range', async () => {
    await morningPerson(user);
    const soon = await addBlock(user, -1, 19, 'PENDING');
    await addBlock(user, -1, 8, 'COMPLETED');
    await addBlock(user, -20, 19, 'PENDING'); // beyond the default 14 days
    const { data } = (await risk(user).expect(200)).body;
    expect(data.risks.map((r: { id: string }) => r.id)).toEqual([soon.id]);
  });
});
