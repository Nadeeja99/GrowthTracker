import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { estimateQuerySchema } from '../utils/validation';
import { MODEL, predictDuration, roundMinutes, TimedTask } from '../services/estimates/calibration';

// "Tasks like this usually take you about…": the estimate-calibration model
// (ml/MODEL_CARD.md) applied to the person's own finished, timed tasks. It
// runs in-process from a small JSON file: no AI provider, no cost per request,
// and nothing leaves the server.
const router = Router();

router.use(authenticate);

/** The person's most recent finished tasks that have both an estimate and logged time. */
async function timedHistory(userId: string, excludeTaskId?: string): Promise<TimedTask[]> {
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      estimatedTime: { gte: 1 },
      actualTime: { gte: 1 },
      // Editing a finished task shouldn't let it predict itself.
      ...(excludeTaskId && { id: { not: excludeTaskId } }),
    },
    orderBy: [{ completedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
    take: MODEL.historyLimit,
    select: { estimatedTime: true, actualTime: true, priority: true, dueDate: true, goalId: true, _count: { select: { subtasks: true } } },
  });
  return tasks.map(t => ({
    estimateMinutes: t.estimatedTime!,
    actualMinutes: t.actualTime!,
    priority: t.priority,
    subtasks: t._count.subtasks,
    hasDueDate: t.dueDate !== null,
    goalId: t.goalId,
  }));
}

router.get('/', async (req: AuthRequest, res) => {
  const query = estimateQuerySchema.parse(req.query);
  const history = await timedHistory(req.user!.id, query.excludeTaskId);

  // Until their own record outweighs the population average (model card,
  // "When suggestions appear"), say how many more timed tasks are needed instead.
  if (history.length < MODEL.minHistory) {
    return void res.json({
      success: true,
      data: { estimate: null, timedTasks: history.length, minHistory: MODEL.minHistory, modelVersion: MODEL.metadata.version },
    });
  }

  const prediction = predictDuration(
    MODEL,
    { estimateMinutes: query.minutes, priority: query.priority, subtasks: query.subtasks, hasDueDate: query.hasDueDate, goalId: query.goalId ?? null },
    history,
  );
  res.json({
    success: true,
    data: {
      estimate: {
        minutes: query.minutes,
        suggestedMinutes: roundMinutes(prediction.predictedMinutes),
        lowMinutes: roundMinutes(prediction.lowMinutes),
        highMinutes: roundMinutes(prediction.highMinutes),
        ratio: Math.round((prediction.predictedMinutes / query.minutes) * 100) / 100,
        coverage: MODEL.intervals.coverage,
        basedOn: { tasks: prediction.historyUsed, goalTasks: query.goalId ? prediction.goalHistoryUsed : 0 },
      },
      timedTasks: history.length,
      minHistory: MODEL.minHistory,
      modelVersion: MODEL.metadata.version,
    },
  });
});

export default router;
