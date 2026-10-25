import http from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import { app } from '../src/app';
import { CoachModel, CoachModelError, CoachModelRequest, CoachModelResult, setCoachModelForTests } from '../src/services/coach/model';
import { normalizeSuggestions, suggestActionsJsonSchema, suggestActionsSchema } from '../src/services/coach/suggestions';
import { addDays, dateKeyInZone } from '../src/utils/dates';
import { auth, prisma, registerUser, resetDatabase, TestUser } from './helpers';
import { parseSse } from './fake-openai';

/** A scripted model that records what it was asked. */
class FakeModel implements CoachModel {
  readonly name = 'fake-model';
  requests: CoachModelRequest[] = [];
  next: (req: CoachModelRequest) => Promise<CoachModelResult> = async () => this.result('Hello there.');

  result(text: string, suggestionArgs: string | null = null): CoachModelResult {
    return { text, suggestionArgs, inputTokens: 1000, outputTokens: 50, truncated: false };
  }

  async reply(req: CoachModelRequest) {
    this.requests.push(req);
    return this.next(req);
  }
}

const action = (overrides: Record<string, unknown>) => ({
  type: 'task', title: 'Do it', reason: 'Because.', goalId: null, priority: null, dueDate: null,
  date: null, startTime: null, durationMinutes: null, frequency: null, ...overrides,
});

let model: FakeModel;
let alice: TestUser;
let aliceGoalId: string;
const tomorrow = () => addDays(dateKeyInZone(new Date(), 'UTC'), 1);

const send = (user: TestUser, message: string) =>
  request(app).post('/api/coach/messages').set(auth(user.token)).send({ message });

beforeAll(async () => {
  await resetDatabase();
  alice = await registerUser(app, { timezone: 'UTC' });
  aliceGoalId = (await request(app).post('/api/goals').set(auth(alice.token)).send({ title: 'Half marathon' })).body.data.goal.id;
});
beforeEach(() => {
  model = new FakeModel();
  setCoachModelForTests(model);
});
afterAll(async () => {
  setCoachModelForTests(undefined);
  await prisma.$disconnect();
});

describe('configuration and consent', () => {
  it('reports when no AI provider is configured', async () => {
    setCoachModelForTests(null);
    const status = (await request(app).get('/api/coach').set(auth(alice.token))).body.data;
    expect(status).toMatchObject({ configured: false, enabled: false, usage: { used: 0, limit: 20, remaining: 20 }, messages: [] });
    expect((await send(alice, 'hi')).status).toBe(503);
  });

  it('sends nothing to the model until the user opts in', async () => {
    const res = await send(alice, 'hi');
    expect(res.status).toBe(403);
    expect(model.requests).toHaveLength(0);

    await request(app).put('/api/coach/settings').set(auth(alice.token)).send({ enabled: true }).expect(200);
    expect((await request(app).get('/api/coach').set(auth(alice.token))).body.data).toMatchObject({ configured: true, enabled: true });
  });

  it('validates the message', async () => {
    expect((await send(alice, '   ')).status).toBe(400);
    expect((await send(alice, 'x'.repeat(1001))).status).toBe(400);
  });
});

describe('conversation', () => {
  it('streams the reply, then saves the turn with validated suggestions', async () => {
    model.next = async req => {
      req.onText('Book a ');
      req.onText('run.');
      return model.result('Book a run.', JSON.stringify({
        actions: [
          action({ type: 'time_block', title: 'Easy run', goalId: aliceGoalId, date: tomorrow(), startTime: '18:00', durationMinutes: 45 }),
          action({ type: 'task', title: 'Buy gels', goalId: 'someone-elses-goal', priority: 'LOW' }),
          action({ type: 'time_block', title: 'In the past', date: '2020-01-01', startTime: '07:00', durationMinutes: 30 }),
          action({ type: 'habit', title: 'Stretch', frequency: 'DAILY' }),
        ],
      }));
    };

    const res = await send(alice, 'How is my running going?');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    const events = parseSse(res.text);
    expect(events.filter(e => e.event === 'delta').map(e => e.data.text)).toEqual(['Book a ', 'run.']);

    const done = events.find(e => e.event === 'done')!.data;
    expect(done.userMessage).toMatchObject({ role: 'user', content: 'How is my running going?' });
    expect(done.message).toMatchObject({ role: 'assistant', content: 'Book a run.' });
    expect(done.usage).toMatchObject({ used: 1, remaining: 19 });

    const [block, task, habit] = done.message.suggestions;
    expect(done.message.suggestions).toHaveLength(3); // the past block was dropped
    expect(block).toMatchObject({ kind: 'time_block', goalId: aliceGoalId, startTime: `${tomorrow()}T18:00:00.000Z`, endTime: `${tomorrow()}T18:45:00.000Z` });
    expect(task).toMatchObject({ kind: 'task', goalId: null, priority: 'LOW' }); // foreign goal unlinked
    expect(habit).toMatchObject({ kind: 'habit', title: 'Stretch', frequency: 'DAILY' });

    const saved = (await request(app).get('/api/coach').set(auth(alice.token))).body.data.messages;
    expect(saved.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant']);
  });

  it('gives the model the user\'s data and the conversation so far, but not their account details', async () => {
    await send(alice, 'And what next?');
    const { instructions, input } = model.requests[0];
    expect(instructions).toContain('Half marathon');
    expect(instructions).toContain(aliceGoalId);
    expect(instructions).not.toContain(alice.email);
    expect(input.map(t => t.role)).toEqual(['user', 'assistant', 'user']);
    expect(input.at(-1)).toEqual({ role: 'user', content: 'And what next?' });
  });

  it('applies a suggestion once', async () => {
    const messages = (await request(app).get('/api/coach').set(auth(alice.token))).body.data.messages;
    const reply = messages.find((m: { suggestions: unknown[] }) => m.suggestions.length);
    const block = reply.suggestions[0];
    const url = `/api/coach/messages/${reply.id}/suggestions/${block.id}/apply`;

    const res = await request(app).post(url).set(auth(alice.token));
    expect(res.status).toBe(201);
    const schedule = await prisma.schedule.findUniqueOrThrow({ where: { id: res.body.data.suggestion.appliedId } });
    expect(schedule).toMatchObject({ userId: alice.user.id, goalId: aliceGoalId, title: 'Easy run', status: 'PENDING' });

    expect((await request(app).post(url).set(auth(alice.token))).status).toBe(409);
    const bob = await registerUser(app);
    expect((await request(app).post(url).set(auth(bob.token))).status).toBe(404);

    const task = reply.suggestions[1];
    const created = await request(app).post(`/api/coach/messages/${reply.id}/suggestions/${task.id}/apply`).set(auth(alice.token));
    expect(await prisma.task.findUniqueOrThrow({ where: { id: created.body.data.suggestion.appliedId } })).toMatchObject({ title: 'Buy gels', priority: 'LOW' });
  });

  it('reports provider failures without saving the turn or using up the quota', async () => {
    model.next = async () => { throw new CoachModelError('Rate limited', 429); };
    const before = await prisma.coachMessage.count();
    const res = await send(alice, 'Hello?');
    expect(parseSse(res.text)).toEqual([{ event: 'error', data: { message: 'The AI service is busy right now. Please try again in a minute.' } }]);
    expect(await prisma.coachMessage.count()).toBe(before);
    expect((await request(app).get('/api/coach').set(auth(alice.token))).body.data.usage.used).toBe(2);
  });

  it('answers one message at a time per user', async () => {
    let release!: () => void;
    model.next = () => new Promise(resolve => { release = () => resolve(model.result('Done.')); });
    const first = send(alice, 'Long question').then(r => r);
    await waitFor(() => model.requests.length === 1);
    expect((await send(alice, 'Impatient')).status).toBe(409);
    release();
    expect((await first).status).toBe(200);
  });

  it('stops generating when the client disconnects', async () => {
    let sawAbort = false;
    model.next = req => new Promise((_resolve, reject) => {
      req.onText('Thinking');
      req.signal.addEventListener('abort', () => { sawAbort = true; reject(new Error('aborted')); });
    });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    await new Promise<void>(resolve => {
      const req = http.request({
        port, method: 'POST', path: '/api/coach/messages',
        headers: { ...auth(alice.token), 'Content-Type': 'application/json' },
      }, res => res.once('data', () => { req.destroy(); resolve(); }));
      req.end(JSON.stringify({ message: 'Never mind' }));
    });
    await waitFor(() => sawAbort);
    await waitFor(async () => (await prisma.aiUsage.count({ where: { status: 'aborted' } })) === 1);
    server.close();
  });

  it('clears the conversation', async () => {
    await request(app).delete('/api/coach/messages').set(auth(alice.token)).expect(200);
    expect((await request(app).get('/api/coach').set(auth(alice.token))).body.data.messages).toEqual([]);
  });
});

describe('daily limits', () => {
  it('stops at the daily cap', async () => {
    const carol = await registerUser(app, { timezone: 'Europe/Dublin' });
    await prisma.user.update({ where: { id: carol.user.id }, data: { aiCoachEnabled: true } });
    await prisma.aiUsage.createMany({ data: Array.from({ length: 20 }, () => ({ userId: carol.user.id, model: 'x', status: 'ok' })) });
    // A failed call on top doesn't count.
    await prisma.aiUsage.create({ data: { userId: carol.user.id, model: 'x', status: 'error' } });

    const res = await send(carol, 'One more?');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/all 20 coach messages/);
    expect(model.requests).toHaveLength(0);
  });

  it('gives the shared demo account its own budget', async () => {
    const { seedDemo, DEMO_EMAIL } = await import('../src/scripts/seed');
    await seedDemo();
    const login = await request(app).post('/api/auth/login').send({ email: DEMO_EMAIL, password: 'demo-password-1' });
    const status = (await request(app).get('/api/coach').set(auth(login.body.data.accessToken))).body.data;
    expect(status).toMatchObject({ enabled: true, usage: { limit: 30 } });
    expect(status.messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant']);
  });
});

describe('suggestion validation', () => {
  const ctx = { todayKey: '2026-10-25', timezone: 'Europe/Dublin', goalIds: new Set(['g1']), now: new Date('2026-10-25T09:00:00Z') };

  it('keeps the JSON Schema sent to the model in sync with the validator', () => {
    const zodFields = Object.keys(suggestActionsSchema.shape.actions.element.shape).sort();
    expect(Object.keys(suggestActionsJsonSchema.properties.actions.items.properties).sort()).toEqual(zodFields);
    expect([...suggestActionsJsonSchema.properties.actions.items.required].sort()).toEqual(zodFields);
  });

  it('converts local wall-clock times across the DST change', () => {
    // Clocks go back on 25 Oct 2026 in Dublin: 09:00 local is 09:00 UTC; the day before it was 08:00 UTC.
    const [block] = normalizeSuggestions(JSON.stringify({ actions: [action({ type: 'time_block', date: '2026-10-26', startTime: '09:00', durationMinutes: 500 })] }), ctx);
    expect(block).toMatchObject({ kind: 'time_block', startTime: '2026-10-26T09:00:00.000Z', endTime: '2026-10-26T13:00:00.000Z' }); // clamped to 4h
  });

  it('drops malformed output and anything outside the planning horizon', () => {
    expect(normalizeSuggestions('not json', ctx)).toEqual([]);
    expect(normalizeSuggestions(JSON.stringify({ actions: [{ type: 'task' }] }), ctx)).toEqual([]);
    const out = normalizeSuggestions(JSON.stringify({
      actions: [
        action({ type: 'time_block', date: '2026-12-01', startTime: '09:00', durationMinutes: 30 }), // > 14 days ahead
        action({ type: 'time_block', date: '2026-10-26', startTime: '25:00', durationMinutes: 30 }), // bad time
        action({ type: 'task', title: '   ', priority: 'HIGH' }), // empty title
        action({ type: 'task', title: 'Due far away', dueDate: '2027-06-01' }),
      ],
    }), ctx);
    expect(out).toEqual([expect.objectContaining({ kind: 'task', title: 'Due far away', dueDate: null, priority: 'MEDIUM' })]);
  });
});

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 5000) {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, 20));
  }
}
