import request from 'supertest';
import { app } from '../src/app';
import { AiModel, GenerateRequest, GenerateResult, setAiModelForTests } from '../src/services/ai/model';
import { weekStartKey } from '../src/services/ai/time';
import { suggestActionsJsonSchema, suggestActionsSchema } from '../src/services/coach/suggestions';
import { weeklyReviewJsonSchema, weeklyReviewSchema } from '../src/services/features/weeklyReview';
import { normalizeWeekPlan, weekPlanJsonSchema, weekPlanSchema } from '../src/services/features/weekPlan';
import { goalBreakdownJsonSchema, goalBreakdownSchema, normalizeMilestones } from '../src/services/features/goalBreakdown';
import { addDays, dateKeyInZone, zonedTimeToInstant } from '../src/utils/dates';
import { auth, prisma, registerUser, resetDatabase, TestUser } from './helpers';
import { z } from 'zod';

/** Answers structured requests with whatever the test sets. */
class FakeModel implements AiModel {
  readonly name = 'fake-model';
  requests: GenerateRequest[] = [];
  output: unknown = {};

  async reply(): Promise<never> {
    throw new Error('not used');
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    this.requests.push(req);
    const json = typeof this.output === 'string' ? this.output : JSON.stringify(this.output);
    return { json, inputTokens: 800, outputTokens: 120, truncated: false };
  }
}

let model: FakeModel;
let user: TestUser;
let goalId: string;
const today = () => dateKeyInZone(new Date(), 'UTC');
const thisWeek = () => weekStartKey(today());

beforeAll(async () => {
  await resetDatabase();
  user = await registerUser(app, { timezone: 'UTC' });
  goalId = (await request(app).post('/api/goals').set(auth(user.token)).send({ title: 'AWS cert', targetHoursWeekly: 6 })).body.data.goal.id;
});
beforeEach(() => {
  model = new FakeModel();
  setAiModelForTests(model);
});
afterAll(async () => {
  setAiModelForTests(undefined);
  await prisma.$disconnect();
});

describe('weekly review', () => {
  const review = (u: TestUser, weekStart = thisWeek()) =>
    request(app).post('/api/ai/weekly-review').set(auth(u.token)).send({ weekStart });

  it('needs the opt-in, a Sunday, a week that has started, and something to review', async () => {
    expect((await review(user)).status).toBe(403);
    await request(app).put('/api/coach/settings').set(auth(user.token)).send({ enabled: true });

    expect((await review(user, addDays(thisWeek(), 1))).status).toBe(400);
    expect((await review(user, addDays(thisWeek(), 7))).status).toBe(400);
    const empty = await review(user);
    expect(empty.status).toBe(422);
    expect(model.requests).toHaveLength(0); // no AI call without data
  });

  it('generates, cleans up and stores the review', async () => {
    await request(app).put(`/api/reflections/${today()}`).set(auth(user.token)).send({ performance: 4, energy: 2, mood: 3, notes: 'Tired' });
    model.output = {
      headline: 'Solid start.',
      wins: ['a', 'b', 'c', 'd'],
      slips: ['  spaced   out  '],
      patterns: [{ observation: 'Low energy', evidence: 'Today: 2/5' }],
      priorities: [
        { title: 'Study VPC', why: 'Behind', goalId },
        { title: 'Someone else’s goal', why: 'x', goalId: 'not-mine' },
      ],
    };

    const res = await review(user);
    expect(res.status).toBe(201);
    const { content } = res.body.data.review;
    expect(content.wins).toEqual(['a', 'b', 'c']);
    expect(content.slips).toEqual(['spaced out']);
    expect(content.priorities.map((p: { goalId: string | null }) => p.goalId)).toEqual([goalId, null]);

    const { input, schemaName } = model.requests[0];
    expect(schemaName).toBe('weekly_review');
    expect(input).toContain('"energy":2');
    expect(input).toContain('AWS cert');
    expect(input).not.toContain(user.email);

    const saved = await request(app).get(`/api/ai/weekly-review?weekStart=${thisWeek()}`).set(auth(user.token));
    expect(saved.body.data.review.content.headline).toBe('Solid start.');
    expect(await prisma.aiUsage.count({ where: { userId: user.user.id, feature: 'weekly_review', status: 'ok' } })).toBe(1);
  });

  it('regenerating replaces the stored review', async () => {
    model.output = { headline: 'Second take.', wins: [], slips: [], patterns: [], priorities: [] };
    await review(user).expect(201);
    expect(await prisma.weeklyReview.count({ where: { userId: user.user.id } })).toBe(1);
  });

  it('rejects output that doesn\'t match the schema, without charging the user', async () => {
    const before = (await request(app).get('/api/coach').set(auth(user.token))).body.data.usage.used;
    model.output = { headline: 42 };
    const res = await review(user);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/incomplete answer/);
    model.output = 'not json';
    expect((await review(user)).status).toBe(502);
    expect((await request(app).get('/api/coach').set(auth(user.token))).body.data.usage.used).toBe(before);
  });

  it('is private to its owner', async () => {
    const other = await registerUser(app);
    const res = await request(app).get(`/api/ai/weekly-review?weekStart=${thisWeek()}`).set(auth(other.token));
    expect(res.body.data.review).toBeNull();
  });
});

describe('week plan', () => {
  it('returns only blocks that fit: future, inside the window, no overlaps', async () => {
    const nextWeek = addDays(thisWeek(), 7);
    const monday = addDays(nextWeek, 1);
    // An existing block Monday 09:00-10:00.
    await request(app).post('/api/schedules').set(auth(user.token)).send({
      title: 'Standup', startTime: `${monday}T09:00:00.000Z`, endTime: `${monday}T10:00:00.000Z`,
    });
    const block = (date: string, startTime: string, durationMinutes = 60, extra = {}) =>
      ({ title: 'Study', goalId, date, startTime, durationMinutes, reason: 'r', ...extra });
    model.output = {
      summary: 'Mornings.',
      blocks: [
        block(monday, '07:00'),                    // ok
        block(monday, '09:30'),                    // overlaps Standup
        block(monday, '07:30'),                    // overlaps the first proposal
        block(monday, '05:00'),                    // before the window
        block(monday, '20:30', 60),                // runs past the window
        block(addDays(nextWeek, 14), '08:00'),     // not in the week
        block(addDays(nextWeek, 2), '08:00', 600), // clamped to 3 h
        block(addDays(nextWeek, 3), '08:00', 60, { goalId: 'not-mine' }),
      ],
    };

    const res = await request(app).post('/api/ai/week-plan').set(auth(user.token))
      .send({ weekStart: nextWeek, window: { start: '07:00', end: '21:00' } });
    expect(res.status).toBe(200);
    const { blocks, summary } = res.body.data.plan;
    expect(summary).toBe('Mornings.');
    expect(blocks.map((b: { startTime: string; endTime: string; goalId: string | null }) => [b.startTime, b.endTime, b.goalId])).toEqual([
      [`${monday}T07:00:00.000Z`, `${monday}T08:00:00.000Z`, goalId],
      [`${addDays(nextWeek, 2)}T08:00:00.000Z`, `${addDays(nextWeek, 2)}T11:00:00.000Z`, goalId],
      [`${addDays(nextWeek, 3)}T08:00:00.000Z`, `${addDays(nextWeek, 3)}T09:00:00.000Z`, null],
    ]);

    const data = model.requests[0].input;
    expect(data).toContain('"title":"Standup"');
    expect(data).toContain(`"plannableDays":["${nextWeek}"`);
  });

  it('only plans this week or next, with a sensible window', async () => {
    const plan = (body: object) => request(app).post('/api/ai/week-plan').set(auth(user.token)).send(body);
    expect((await plan({ weekStart: addDays(thisWeek(), 14) })).status).toBe(400);
    expect((await plan({ weekStart: addDays(thisWeek(), -7) })).status).toBe(400);
    expect((await plan({ weekStart: thisWeek(), window: { start: '10:00', end: '10:30' } })).status).toBe(400);
    expect((await plan({ weekStart: thisWeek(), window: { start: '7am', end: '9pm' } })).status).toBe(400);
  });

  it('caps blocks per day and handles the DST change', () => {
    const rules = {
      timezone: 'Europe/Dublin', days: ['2026-10-25'], window: { start: 0, end: 24 * 60 },
      busy: [], goalIds: new Set<string>(), now: new Date('2026-10-24T00:00:00Z'),
    };
    const raw = {
      summary: '',
      blocks: ['00:30', '09:00', '11:00', '13:00', '15:00'].map(startTime => ({ title: 'x', goalId: null, date: '2026-10-25', startTime, durationMinutes: 30, reason: '' })),
    };
    const { blocks } = normalizeWeekPlan(raw, rules);
    expect(blocks).toHaveLength(4);
    // Clocks go back at 02:00: 00:30 is still Irish Summer Time (UTC+1); 09:00 is GMT.
    expect(blocks[0].startTime).toBe('2026-10-24T23:30:00.000Z');
    expect(blocks[1].startTime).toBe('2026-10-25T09:00:00.000Z');
  });
});

describe('goal breakdown', () => {
  it('suggests new milestones within the goal\'s deadline', async () => {
    const deadline = addDays(today(), 60);
    const goal = (await request(app).post('/api/goals').set(auth(user.token)).send({ title: 'Ship app', targetDate: `${deadline}T00:00:00.000Z` })).body.data.goal;
    await request(app).post(`/api/goals/${goal.id}/milestones`).set(auth(user.token)).send({ title: 'Design done' });
    model.output = {
      milestones: [
        { title: 'Design done', targetDate: null, why: 'dup' },
        { title: 'Beta live', targetDate: addDays(today(), 30), why: 'ok' },
        { title: 'Launch', targetDate: addDays(today(), 90), why: 'after the deadline' },
        { title: 'Retro', targetDate: '2020-01-01', why: 'past' },
      ],
    };
    const res = await request(app).post(`/api/ai/goals/${goal.id}/milestones`).set(auth(user.token));
    expect(res.body.data.milestones).toEqual([
      { title: 'Beta live', targetDate: addDays(today(), 30), why: 'ok' },
      { title: 'Launch', targetDate: null, why: 'after the deadline' },
      { title: 'Retro', targetDate: null, why: 'past' },
    ]);
    expect(model.requests[0].input).toContain('Design done');
  });

  it('only works on your own goals', async () => {
    const other = await registerUser(app);
    await prisma.user.update({ where: { id: other.user.id }, data: { aiCoachEnabled: true } });
    expect((await request(app).post(`/api/ai/goals/${goalId}/milestones`).set(auth(other.token))).status).toBe(404);
  });

  it('dedupes case-insensitively and caps at six', () => {
    const raw = { milestones: Array.from({ length: 9 }, (_, i) => ({ title: i === 0 ? 'design DONE' : `Step ${i}`, targetDate: null, why: '' })) };
    const out = normalizeMilestones(raw, { todayKey: '2026-10-25', deadline: null, existing: ['Design done'] });
    expect(out.map(m => m.title)).toEqual(['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 6']);
  });
});

describe('schemas sent to the model match the validators', () => {
  // Walks a strict JSON Schema and a zod schema together, comparing object keys.
  /* eslint-disable @typescript-eslint/no-explicit-any -- generic JSON Schema walking */
  function shapeOf(json: any): unknown {
    if (json.type === 'object') return Object.fromEntries(Object.keys(json.properties).sort().map(k => [k, shapeOf(json.properties[k])]));
    if (json.type === 'array') return [shapeOf(json.items)];
    return 'leaf';
  }
  function zodShape(schema: z.ZodTypeAny): unknown {
    if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) return zodShape(schema.unwrap());
    if (schema instanceof z.ZodObject) return Object.fromEntries(Object.keys(schema.shape).sort().map(k => [k, zodShape(schema.shape[k])]));
    if (schema instanceof z.ZodArray) return [zodShape(schema.element)];
    return 'leaf';
  }
  function requiredEverywhere(json: any): boolean {
    if (json.type === 'object') {
      return json.additionalProperties === false
        && [...json.required].sort().join() === Object.keys(json.properties).sort().join()
        && Object.values(json.properties).every(requiredEverywhere);
    }
    return json.type === 'array' ? requiredEverywhere(json.items) : true;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  it.each([
    ['suggest_actions', suggestActionsJsonSchema, suggestActionsSchema],
    ['weekly_review', weeklyReviewJsonSchema, weeklyReviewSchema],
    ['week_plan', weekPlanJsonSchema, weekPlanSchema],
    ['goal_breakdown', goalBreakdownJsonSchema, goalBreakdownSchema],
  ] as const)('%s', (_name, json, zodSchema) => {
    expect(shapeOf(json)).toEqual(zodShape(zodSchema as z.ZodTypeAny));
    expect(requiredEverywhere(json)).toBe(true);
  });
});

it('zonedTimeToInstant is correct on both sides of the DST change', () => {
  expect(zonedTimeToInstant('2026-10-25', 30, 'Europe/Dublin').toISOString()).toBe('2026-10-24T23:30:00.000Z');
  expect(zonedTimeToInstant('2026-10-25', 9 * 60, 'Europe/Dublin').toISOString()).toBe('2026-10-25T09:00:00.000Z');
  expect(zonedTimeToInstant('2026-03-29', 12 * 60, 'Europe/Dublin').toISOString()).toBe('2026-03-29T11:00:00.000Z');
});
