import request from 'supertest';
import { app } from '../src/app';
import { MODEL, predictDuration, roundMinutes, TimedTask } from '../src/services/estimates/calibration';
import { auth, prisma, registerUser, resetDatabase, TestUser } from './helpers';

let user: TestUser;
let goalId: string;

const estimate = (who: TestUser, query: Record<string, string | number | boolean>) =>
  request(app).get('/api/estimates').query(query).set(auth(who.token));

interface Timed {
  estimate: number | null;
  actual: number | null;
  status?: 'COMPLETED' | 'PENDING' | 'IN_PROGRESS' | 'CANCELLED';
  goalId?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: Date | null;
  subtasks?: number;
  minutesAgo?: number;
}

/** Finished tasks inserted directly: the API's history query is what's under test. */
async function addTasks(who: TestUser, tasks: Timed[]) {
  const ids: string[] = [];
  for (const [i, t] of tasks.entries()) {
    const completedAt = new Date(Date.now() - (t.minutesAgo ?? tasks.length - i) * 60_000);
    const created = await prisma.task.create({
      data: {
        userId: who.user.id,
        title: `Task ${i}`,
        status: t.status ?? 'COMPLETED',
        estimatedTime: t.estimate,
        actualTime: t.actual,
        priority: t.priority ?? 'MEDIUM',
        dueDate: t.dueDate ?? null,
        goalId: t.goalId === undefined ? goalId : t.goalId,
        completedAt: (t.status ?? 'COMPLETED') === 'COMPLETED' ? completedAt : null,
        subtasks: { create: Array.from({ length: t.subtasks ?? 0 }, (_, s) => ({ title: `step ${s}` })) },
      },
    });
    ids.push(created.id);
  }
  return ids;
}

const overruns = (n: number): Timed[] => Array.from({ length: n }, () => ({ estimate: 60, actual: 120 }));

beforeEach(async () => {
  await resetDatabase();
  user = await registerUser(app);
  goalId = (await request(app).post('/api/goals').set(auth(user.token)).send({ title: 'Ship app' })).body.data.goal.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/estimates', () => {
  it('needs a signed-in user', async () => {
    await request(app).get('/api/estimates').query({ minutes: 60 }).expect(401);
  });

  it.each([
    ['no minutes', {}],
    ['zero minutes', { minutes: 0 }],
    ['part minutes', { minutes: 1.5 }],
    ['more than a day', { minutes: 1441 }],
    ['not a number', { minutes: 'soon' }],
    ['an unknown priority', { minutes: 30, priority: 'URGENT' }],
    ['negative subtasks', { minutes: 30, subtasks: -1 }],
    ['a due-date flag that is not true or false', { minutes: 30, hasDueDate: 'yes' }],
  ])('rejects %s', async (_name, query) => {
    await estimate(user, query).expect(400);
  });

  it('says how many more timed tasks are needed before suggesting anything', async () => {
    await addTasks(user, overruns(MODEL.minHistory - 1));
    const res = await estimate(user, { minutes: 60 }).expect(200);
    expect(res.body.data).toEqual({
      estimate: null,
      timedTasks: MODEL.minHistory - 1,
      minHistory: MODEL.minHistory,
      modelVersion: MODEL.metadata.version,
    });
  });

  it('suggests more time for someone who runs over, with a range around it', async () => {
    await addTasks(user, overruns(10));
    const { estimate: e } = (await estimate(user, { minutes: 60, goalId }).expect(200)).body.data;
    expect(e.minutes).toBe(60);
    expect(e.suggestedMinutes).toBeGreaterThan(90);
    expect(e.lowMinutes).toBeLessThan(e.suggestedMinutes);
    expect(e.highMinutes).toBeGreaterThan(e.suggestedMinutes);
    expect(e.ratio).toBeGreaterThan(1.5);
    expect(e.coverage).toBe(MODEL.intervals.coverage);
    expect(e.basedOn).toEqual({ tasks: 10, goalTasks: 10 });
  });

  it('suggests less time for someone who finishes early', async () => {
    await addTasks(user, Array.from({ length: 10 }, () => ({ estimate: 60, actual: 30 })));
    const { estimate: e } = (await estimate(user, { minutes: 60 }).expect(200)).body.data;
    expect(e.suggestedMinutes).toBeLessThan(60);
  });

  it('feeds the model the same task details the Python side trained on', async () => {
    const due = new Date();
    const tasks: Timed[] = [
      { estimate: 30, actual: 50, priority: 'HIGH', subtasks: 3, dueDate: due },
      { estimate: 90, actual: 80, priority: 'LOW', goalId: null },
      { estimate: 45, actual: 70 },
      { estimate: 20, actual: 35, subtasks: 1 },
    ];
    await addTasks(user, tasks);
    const res = await estimate(user, { minutes: 40, priority: 'HIGH', subtasks: 2, hasDueDate: true, goalId }).expect(200);

    // Most recent first: addTasks finishes later items more recently.
    const history: TimedTask[] = [...tasks].reverse().map(t => ({
      estimateMinutes: t.estimate!,
      actualMinutes: t.actual!,
      priority: t.priority ?? 'MEDIUM',
      subtasks: t.subtasks ?? 0,
      hasDueDate: Boolean(t.dueDate),
      goalId: t.goalId === null ? null : goalId,
    }));
    const expected = predictDuration(MODEL, { estimateMinutes: 40, priority: 'HIGH', subtasks: 2, hasDueDate: true, goalId }, history);
    expect(res.body.data.estimate.suggestedMinutes).toBe(roundMinutes(expected.predictedMinutes));
    expect(res.body.data.estimate.lowMinutes).toBe(roundMinutes(expected.lowMinutes));
    expect(res.body.data.estimate.highMinutes).toBe(roundMinutes(expected.highMinutes));
    expect(res.body.data.estimate.basedOn).toEqual({ tasks: 4, goalTasks: 3 });
  });

  it('only learns from finished tasks that have both an estimate and logged time', async () => {
    await addTasks(user, [
      ...overruns(MODEL.minHistory - 1),
      { estimate: 60, actual: 120, status: 'PENDING' },
      { estimate: 60, actual: 120, status: 'IN_PROGRESS' },
      { estimate: 60, actual: 120, status: 'CANCELLED' },
      { estimate: null, actual: 120 },
      { estimate: 60, actual: null },
    ]);
    const res = await estimate(user, { minutes: 60 }).expect(200);
    expect(res.body.data.timedTasks).toBe(MODEL.minHistory - 1);
    expect(res.body.data.estimate).toBeNull();
  });

  it('never uses another person’s tasks', async () => {
    const other = await registerUser(app);
    await addTasks(other, overruns(20).map(t => ({ ...t, goalId: null })));
    const res = await estimate(user, { minutes: 60 }).expect(200);
    expect(res.body.data.timedTasks).toBe(0);
    expect(res.body.data.estimate).toBeNull();
  });

  it('counts goal history only for the person’s own goal', async () => {
    await addTasks(user, overruns(5));
    const other = await registerUser(app);
    const theirGoal = (await request(app).post('/api/goals').set(auth(other.token)).send({ title: 'Theirs' })).body.data.goal.id;
    const res = await estimate(user, { minutes: 60, goalId: theirGoal }).expect(200);
    expect(res.body.data.estimate.basedOn).toEqual({ tasks: 5, goalTasks: 0 });
  });

  it('leaves out the task being edited, so it can’t predict itself', async () => {
    const [first] = await addTasks(user, overruns(MODEL.minHistory));
    const res = await estimate(user, { minutes: 60, excludeTaskId: first }).expect(200);
    expect(res.body.data.timedTasks).toBe(MODEL.minHistory - 1);
  });

  it('uses only the most recently finished tasks', async () => {
    const recent: Timed[] = Array.from({ length: MODEL.historyLimit }, (_, i) => ({ estimate: 60, actual: 60, minutesAgo: i + 1 }));
    const older: Timed[] = Array.from({ length: 5 }, (_, i) => ({ estimate: 60, actual: 300, minutesAgo: 10_000 + i }));
    await addTasks(user, [...older, ...recent]);
    const res = await estimate(user, { minutes: 60 }).expect(200);
    expect(res.body.data.timedTasks).toBe(MODEL.historyLimit);

    await prisma.task.deleteMany({ where: { userId: user.user.id, actualTime: 300 } });
    const withoutOld = await estimate(user, { minutes: 60 }).expect(200);
    expect(withoutOld.body.data.estimate).toEqual(res.body.data.estimate);
  });

  it('learns from time logged with the focus timer', async () => {
    for (let i = 0; i < MODEL.minHistory; i++) {
      const task = (await request(app).post('/api/tasks').set(auth(user.token)).send({ title: `Write part ${i}`, goalId, estimatedTime: 30 }).expect(201)).body.data.task;
      const endedAt = new Date();
      await request(app).post('/api/focus-sessions').set(auth(user.token)).send({
        startedAt: new Date(endedAt.getTime() - 50 * 60_000).toISOString(),
        endedAt: endedAt.toISOString(),
        durationSeconds: 50 * 60,
        plannedSeconds: 25 * 60,
        completed: true,
        taskId: task.id,
      }).expect(201);
      await request(app).put(`/api/tasks/${task.id}`).set(auth(user.token)).send({ status: 'COMPLETED' }).expect(200);
    }
    const { data } = (await estimate(user, { minutes: 30, goalId }).expect(200)).body;
    expect(data.timedTasks).toBe(MODEL.minHistory);
    expect(data.estimate.suggestedMinutes).toBeGreaterThan(30);
  });
});

describe('task estimates', () => {
  const create = (estimatedTime: unknown) =>
    request(app).post('/api/tasks').set(auth(user.token)).send({ title: 'Plan', goalId, estimatedTime });

  it('must be whole minutes, at most a day', async () => {
    await create(1.5).expect(400);
    await create(0).expect(400);
    await create(1441).expect(400);
    await create(1440).expect(201);
  });

  it('can be cleared when editing', async () => {
    const task = (await create(45).expect(201)).body.data.task;
    const res = await request(app).put(`/api/tasks/${task.id}`).set(auth(user.token)).send({ estimatedTime: null }).expect(200);
    expect(res.body.data.task.estimatedTime).toBeNull();
    // Leaving it out keeps it.
    await request(app).put(`/api/tasks/${task.id}`).set(auth(user.token)).send({ estimatedTime: 20 }).expect(200);
    const kept = await request(app).put(`/api/tasks/${task.id}`).set(auth(user.token)).send({ title: 'Renamed' }).expect(200);
    expect(kept.body.data.task.estimatedTime).toBe(20);
  });
});
