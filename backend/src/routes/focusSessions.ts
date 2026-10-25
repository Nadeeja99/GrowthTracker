import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { createFocusSessionSchema, instantRangeSchema } from '../utils/validation';
import { logger } from '../utils/logger';
import { assertGoalOwned } from '../utils/ownership';
import { HttpError } from '../utils/httpError';

const router = Router();

router.use(authenticate);

const DEFAULT_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

// Record a finished (or stopped-early) focus interval
router.post('/', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const data = createFocusSessionSchema.parse(req.body);

  let goalId = data.goalId;
  let taskId = data.taskId;
  let task: { id: string; goalId: string | null; actualTime: number | null } | null = null;

  // Started from a planned block: inherit its goal/task unless given explicitly.
  if (data.scheduleId) {
    const block = await prisma.schedule.findFirst({
      where: { id: data.scheduleId, userId },
      select: { goalId: true, taskId: true },
    });
    if (!block) throw new HttpError(404, 'Schedule not found');
    goalId = goalId ?? block.goalId ?? undefined;
    taskId = taskId ?? block.taskId ?? undefined;
  }

  if (taskId) {
    task = await prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true, goalId: true, actualTime: true },
    });
    if (!task) throw new HttpError(404, 'Task not found');
    // Time spent on a task counts toward that task's goal by default.
    goalId = goalId ?? task.goalId ?? undefined;
  }
  if (goalId) {
    await assertGoalOwned(userId, goalId);
  }

  const focusedMinutes = Math.round(data.durationSeconds / 60);

  const session = await prisma.$transaction(async tx => {
    const created = await tx.focusSession.create({
      data: {
        userId,
        goalId,
        taskId: task?.id,
        scheduleId: data.scheduleId,
        startedAt: new Date(data.startedAt),
        endedAt: new Date(data.endedAt),
        durationSeconds: data.durationSeconds,
        plannedSeconds: data.plannedSeconds,
        completed: data.completed,
      },
    });
    // Feed the task's logged time (minutes), which time-allocation analytics use.
    if (task && focusedMinutes > 0) {
      await tx.task.update({
        where: { id: task.id },
        data: { actualTime: (task.actualTime ?? 0) + focusedMinutes },
      });
    }
    return created;
  });

  logger.info('Focus session recorded', { userId, sessionId: session.id, durationSeconds: data.durationSeconds });

  res.status(201).json({ success: true, data: { session } });
});

// List focus sessions that started in a time range (defaults to the last 30 days)
router.get('/', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { startDate, endDate } = instantRangeSchema.parse(req.query);

  const sessions = await prisma.focusSession.findMany({
    where: {
      userId,
      startedAt: {
        gte: startDate ? new Date(startDate) : new Date(Date.now() - DEFAULT_LOOKBACK_MS),
        ...(endDate && { lte: new Date(endDate) }),
      },
    },
    orderBy: { startedAt: 'asc' },
    take: 1000,
  });

  res.json({ success: true, data: { sessions } });
});

export default router;
