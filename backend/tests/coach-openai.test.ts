import './coach-openai-env';
import request from 'supertest';
import { app } from '../src/app';
import { suggestActionsJsonSchema } from '../src/services/coach/suggestions';
import { addDays, dateKeyInZone } from '../src/utils/dates';
import { auth, prisma, registerUser, resetDatabase, TestUser } from './helpers';
import { FakeOpenAI, parseSse, startFakeOpenAI } from './fake-openai';

// Runs the real OpenAI SDK against a local server that speaks the Responses
// streaming protocol, to check the request we send and how we read the stream.
let fake: FakeOpenAI;
let user: TestUser;

beforeAll(async () => {
  await resetDatabase();
  fake = await startFakeOpenAI();
  process.env.OPENAI_BASE_URL = fake.url;
  user = await registerUser(app, { timezone: 'UTC' });
  await request(app).put('/api/coach/settings').set(auth(user.token)).send({ enabled: true });
});
afterAll(async () => {
  await fake.close();
  await prisma.$disconnect();
});

it('streams text deltas and reads the suggest_actions call', async () => {
  const date = addDays(dateKeyInZone(new Date(), 'UTC'), 2);
  fake.script = {
    text: ['You have ', 'a free evening.'],
    toolArgs: JSON.stringify({ actions: [{
      type: 'time_block', title: 'Deep work', reason: 'Free slot.', goalId: null, priority: null, dueDate: null,
      date, startTime: '19:30', durationMinutes: 60, frequency: null,
    }] }),
  };

  const res = await request(app).post('/api/coach/messages').set(auth(user.token)).send({ message: 'Plan my week' });
  const events = parseSse(res.text);
  expect(events.filter(e => e.event === 'delta').map(e => e.data.text)).toEqual(['You have ', 'a free evening.']);
  const done = events.find(e => e.event === 'done')!.data;
  expect(done.message.content).toBe('You have a free evening.');
  expect(done.message.suggestions[0]).toMatchObject({ kind: 'time_block', title: 'Deep work', startTime: `${date}T19:30:00.000Z` });

  const usage = await prisma.aiUsage.findFirstOrThrow({ where: { userId: user.user.id } });
  expect(usage).toMatchObject({ status: 'ok', model: 'gpt-6-luna', inputTokens: 1200, outputTokens: 90 });

  const { headers, body } = fake.requests[0];
  expect(headers.authorization).toBe('Bearer sk-test-not-a-real-key-0123456789');
  expect(body).toMatchObject({
    model: 'gpt-6-luna',
    stream: true,
    store: false,
    reasoning: { effort: 'low' },
    max_output_tokens: 1500,
    parallel_tool_calls: false,
    input: [{ role: 'user', content: 'Plan my week' }],
  });
  expect(body.tools).toEqual([expect.objectContaining({ type: 'function', name: 'suggest_actions', strict: true, parameters: suggestActionsJsonSchema })]);
  expect(body.instructions).toMatch(/<data>[\s\S]*"timezone":"UTC"[\s\S]*<\/data>/);
});

it('marks a reply cut off by the token limit', async () => {
  fake.script = { text: ['Here is a long'], status: 'incomplete' };
  const res = await request(app).post('/api/coach/messages').set(auth(user.token)).send({ message: 'Tell me everything' });
  expect(parseSse(res.text).find(e => e.event === 'done')!.data.message.content).toBe('Here is a long …');
});

it('turns provider errors into a friendly message', async () => {
  fake.script = { httpError: 401 };
  const res = await request(app).post('/api/coach/messages').set(auth(user.token)).send({ message: 'Hi' });
  expect(parseSse(res.text)).toEqual([{ event: 'error', data: { message: 'AI Coach is temporarily unavailable.' } }]);
});
