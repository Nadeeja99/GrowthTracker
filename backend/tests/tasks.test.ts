import request from 'supertest';
import { app } from '../src/app';
import { auth, prisma, registerUser, resetDatabase } from './helpers';

let token: string;
let goalId: string;
beforeAll(async () => {
  await resetDatabase();
  token = (await registerUser(app)).token;
  goalId = (await request(app).post('/api/goals').set(auth(token)).send({ title: 'Goal' })).body.data.goal.id;
});
afterAll(() => prisma.$disconnect());

const put = (id: string, body: Record<string, unknown>) =>
  request(app).put(`/api/tasks/${id}`).set(auth(token)).send(body).then(r => r.body.data.task);

it('can unlink a task from its goal (B1) and clear its due date', async () => {
  const { task } = (await request(app).post('/api/tasks').set(auth(token))
    .send({ title: 'Linked', goalId, dueDate: new Date().toISOString() })).body.data;
  expect((await put(task.id, { goalId: null })).goalId).toBeNull();
  expect((await put(task.id, { dueDate: null })).dueDate).toBeNull();
});

it('keeps completedAt on re-save and clears it on reopen (B2)', async () => {
  const { task } = (await request(app).post('/api/tasks').set(auth(token)).send({ title: 'Finish me' })).body.data;
  const done = await put(task.id, { status: 'COMPLETED' });
  expect(done.completedAt).toBeTruthy();
  expect((await put(task.id, { status: 'COMPLETED', title: 'Renamed' })).completedAt).toBe(done.completedAt);
  expect((await put(task.id, { status: 'PENDING' })).completedAt).toBeNull();
});

it('saves tags (trimmed, de-duplicated) and ordered subtasks', async () => {
  const { task } = (await request(app).post('/api/tasks').set(auth(token)).send({
    title: 'Plan', tags: ['running', 'Running', ' health '],
    subtasks: [{ title: 'Pick plan' }, { title: 'Buy shoes', completed: true }, { title: 'Book race' }],
  })).body.data;
  expect(task.tags.map((t: { name: string }) => t.name)).toEqual(['health', 'running']);
  expect(task.subtasks.map((s: { title: string }) => s.title)).toEqual(['Pick plan', 'Buy shoes', 'Book race']);
  expect(task.subtasks[1].completed).toBe(true);
});

it('syncs the subtask list by id: removing one never shifts the others', async () => {
  const { task } = (await request(app).post('/api/tasks').set(auth(token))
    .send({ title: 'Sync', subtasks: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] })).body.data;
  const [a, b, c] = task.subtasks;
  const updated = await put(task.id, {
    tags: ['racing'],
    subtasks: [{ id: b.id, title: 'b renamed', completed: true }, { id: c.id, title: 'c', completed: false }, { title: 'd' }],
  });
  expect(updated.subtasks.map((s: { id: string }) => s.id).slice(0, 2)).toEqual([b.id, c.id]);
  expect(updated.subtasks.some((s: { id: string }) => s.id === a.id)).toBe(false);
  expect(updated.subtasks.map((s: { title: string }) => s.title)).toEqual(['b renamed', 'c', 'd']);
  expect(updated.tags.map((t: { name: string }) => t.name)).toEqual(['racing']);
});

it('toggles a single subtask and deletes subtasks with their task', async () => {
  const { task } = (await request(app).post('/api/tasks').set(auth(token)).send({ title: 'Toggle', subtasks: [{ title: 'x' }] })).body.data;
  const res = await request(app).patch(`/api/tasks/${task.id}/subtasks/${task.subtasks[0].id}`).set(auth(token)).send({ completed: true });
  expect(res.body.data.subtask.completed).toBe(true);
  await request(app).delete(`/api/tasks/${task.id}`).set(auth(token));
  expect(await prisma.subtask.count({ where: { taskId: task.id } })).toBe(0);
});

it('returns 400 with field errors for invalid input (B7)', async () => {
  const res = await request(app).post('/api/tasks').set(auth(token)).send({});
  expect(res.status).toBe(400);
  expect(res.body.validationErrors.length).toBeGreaterThan(0);
  expect(res.body.requestId).toBeTruthy();
});
