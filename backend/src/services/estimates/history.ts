import { prisma } from '../../config/database';
import { MODEL, TimedTask } from './calibration';

/** The person's most recent finished tasks that have both an estimate and logged time. */
export async function timedHistory(userId: string, excludeTaskId?: string): Promise<TimedTask[]> {
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
