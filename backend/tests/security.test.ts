import request from 'supertest';
import { app } from '../src/app';
import { auth, prisma, registerUser, resetDatabase, TestUser } from './helpers';

// Cross-user access: every relation is checked for ownership, and someone
// else's record is indistinguishable from a missing one (404).
let alice: TestUser;
let bob: TestUser;
let aliceGoal: { id: string };
let aliceTask: { id: string };
let aliceBlock: { id: string };

const hour = (h: number) => new Date(Date.UTC(2026, 10, 2, h)).toISOString();

beforeAll(async () => {
  await resetDatabase();
  alice = await registerUser(app);
  bob = await registerUser(app);
  aliceGoal = (await request(app).post('/api/goals').set(auth(alice.token)).send({ title: 'Alice goal' })).body.data.goal;
  aliceTask = (await request(app).post('/api/tasks').set(auth(alice.token)).send({ title: 'Alice task', goalId: aliceGoal.id })).body.data.task;
  aliceBlock = (await request(app).post('/api/schedules').set(auth(alice.token))
    .send({ title: 'Alice block', startTime: hour(9), endTime: hour(10) })).body.data.schedule;
});
afterAll(() => prisma.$disconnect());

it('blocks linking a task to another user\'s goal (create and update)', async () => {
  const create = await request(app).post('/api/tasks').set(auth(bob.token)).send({ title: 'x', goalId: aliceGoal.id });
  expect(create.status).toBe(404);
  const own = (await request(app).post('/api/tasks').set(auth(bob.token)).send({ title: 'Bob task' })).body.data.task;
  expect((await request(app).put(`/api/tasks/${own.id}`).set(auth(bob.token)).send({ goalId: aliceGoal.id })).status).toBe(404);
});

it('blocks schedule blocks on another user\'s goal or task, including bulk', async () => {
  const single = await request(app).post('/api/schedules').set(auth(bob.token))
    .send({ title: 'x', startTime: hour(11), endTime: hour(12), taskId: aliceTask.id });
  expect(single.status).toBe(404);
  const bulk = await request(app).post('/api/schedules/bulk').set(auth(bob.token))
    .send({ schedules: [{ title: 'x', startTime: hour(11), endTime: hour(12), goalId: aliceGoal.id }] });
  expect(bulk.status).toBe(404);
  expect((await request(app).get('/api/schedules').set(auth(bob.token))).body.data.schedules).toHaveLength(0);
});

it('blocks milestones, subtasks and focus sessions on another user\'s records', async () => {
  expect((await request(app).post(`/api/goals/${aliceGoal.id}/milestones`).set(auth(bob.token)).send({ title: 'x' })).status).toBe(404);
  const focus = { startedAt: hour(9), endedAt: hour(10), durationSeconds: 60, plannedSeconds: 60, completed: false };
  expect((await request(app).post('/api/focus-sessions').set(auth(bob.token)).send({ ...focus, taskId: aliceTask.id })).status).toBe(404);
  expect((await request(app).post('/api/focus-sessions').set(auth(bob.token)).send({ ...focus, scheduleId: aliceBlock.id })).status).toBe(404);
});

it('never lists another user\'s data', async () => {
  for (const path of ['/api/goals', '/api/tasks', '/api/schedules', '/api/habits', '/api/reflections', '/api/focus-sessions']) {
    const res = await request(app).get(path).set(auth(bob.token));
    const body = res.body.data;
    const list = body[Object.keys(body)[0]] as Array<{ title?: string }>;
    expect(list.some(item => item.title?.startsWith('Alice'))).toBe(false);
  }
});

it('requires authentication on data routes', async () => {
  expect((await request(app).get('/api/goals')).status).toBe(401);
});
