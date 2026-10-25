import request from 'supertest';
import { app } from '../src/app';
import { auth, prisma, registerUser, resetDatabase } from './helpers';

let token: string;
beforeAll(async () => {
  await resetDatabase();
  token = (await registerUser(app)).token;
});
afterAll(() => prisma.$disconnect());

const createGoal = (body: Record<string, unknown>) =>
  request(app).post('/api/goals').set(auth(token)).send(body);

it('stores colour, hour targets and description in real columns', async () => {
  const { goal } = (await createGoal({
    title: 'Half marathon', description: 'Under 2h', priority: 'HIGH', color: '#10B981', targetHoursWeekly: 6, targetHoursDaily: 1,
  })).body.data;
  expect(goal).toMatchObject({ color: '#10B981', targetHoursWeekly: 6, targetHoursDaily: 1, description: 'Under 2h', priority: 'HIGH' });
});

it('partial updates leave other fields untouched (B3)', async () => {
  const { goal } = (await createGoal({ title: 'Read', color: '#3B82F6', targetHoursWeekly: 4, targetHoursDaily: 0.5 })).body.data;
  const updated = (await request(app).put(`/api/goals/${goal.id}`).set(auth(token)).send({ color: '#EF4444' })).body.data.goal;
  expect(updated).toMatchObject({ color: '#EF4444', targetHoursWeekly: 4, targetHoursDaily: 0.5 });
});

it('validates colour and only accepts three priority levels', async () => {
  expect((await createGoal({ title: 'x', color: 'red' })).status).toBe(400);
  expect((await createGoal({ title: 'x', priority: 'URGENT' })).status).toBe(400);
});

it('can clear the description', async () => {
  const { goal } = (await createGoal({ title: 'Clear me', description: 'temp' })).body.data;
  const updated = (await request(app).put(`/api/goals/${goal.id}`).set(auth(token)).send({ description: null })).body.data.goal;
  expect(updated.description).toBeNull();
});

describe('milestones drive progress', () => {
  it('derives progress from completed milestones and ignores manual progress', async () => {
    const { goal } = (await createGoal({ title: 'Certification' })).body.data;
    const m1 = (await request(app).post(`/api/goals/${goal.id}/milestones`).set(auth(token)).send({ title: 'Exam 1' })).body.data;
    const m2 = (await request(app).post(`/api/goals/${goal.id}/milestones`).set(auth(token)).send({ title: 'Exam 2' })).body.data;
    expect(m2.goal.progress).toBe(0);

    const done = (await request(app).put(`/api/milestones/${m1.milestone.id}`).set(auth(token)).send({ completed: true })).body.data;
    expect(done.goal.progress).toBe(50);

    const manual = (await request(app).put(`/api/goals/${goal.id}`).set(auth(token)).send({ progress: 90 })).body.data.goal;
    expect(manual.progress).toBe(50);

    const afterDelete = (await request(app).delete(`/api/milestones/${m2.milestone.id}`).set(auth(token))).body.data;
    expect(afterDelete.goal.progress).toBe(100);
    expect(afterDelete.goal.milestones).toHaveLength(1);
  });
});

describe('demo seed', () => {
  it('creates a complete demo account and can be re-run safely', async () => {
    const { seedDemo, DEMO_EMAIL } = await import('../src/scripts/seed');
    await seedDemo();
    await seedDemo(); // idempotent: replaces only the demo user
    const user = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL } });
    expect(await prisma.goal.count({ where: { userId: user.id } })).toBe(3);
    expect(await prisma.schedule.count({ where: { userId: user.id } })).toBe(11); // 7 study + 3 runs + 1 exam
    const login = await request(app).post('/api/auth/login').send({ email: DEMO_EMAIL, password: 'demo-password-1' });
    expect(login.status).toBe(200);
  });
});
