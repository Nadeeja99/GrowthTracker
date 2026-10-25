import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

type Db = Prisma.TransactionClient | typeof prisma;

export const goalInclude = {
  milestones: { orderBy: { createdAt: 'asc' } },
  _count: { select: { tasks: true } },
} satisfies Prisma.GoalInclude;

// A goal with milestones derives its progress from them (completed / total);
// without milestones, progress stays whatever the user last set manually.
export async function syncGoalProgress(db: Db, goalId: string): Promise<void> {
  const [total, completed] = await Promise.all([
    db.milestone.count({ where: { goalId } }),
    db.milestone.count({ where: { goalId, completed: true } }),
  ]);
  if (total === 0) return;
  await db.goal.update({
    where: { id: goalId },
    data: { progress: Math.round((completed / total) * 100) },
  });
}

export async function hasMilestones(db: Db, goalId: string): Promise<boolean> {
  return (await db.milestone.count({ where: { goalId } })) > 0;
}
