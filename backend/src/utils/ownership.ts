import { prisma } from '../config/database';
import { HttpError } from './httpError';

// Relations are connected by id, so without these checks a user could attach
// their records to (and read back the title of) another user's goal or task.
// Both "missing" and "owned by someone else" return the same 404 so ids of
// other users' records cannot be probed.

export async function assertGoalOwned(userId: string, goalId: string): Promise<void> {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
  if (!goal) {
    throw new HttpError(404, 'Goal not found');
  }
}

export async function assertTaskOwned(userId: string, taskId: string): Promise<void> {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId }, select: { id: true } });
  if (!task) {
    throw new HttpError(404, 'Task not found');
  }
}

// Batch variants: one query for any number of ids (used by bulk endpoints).
export async function assertGoalsOwned(userId: string, goalIds: string[]): Promise<void> {
  const unique = [...new Set(goalIds)];
  if (unique.length === 0) return;
  const owned = await prisma.goal.count({ where: { id: { in: unique }, userId } });
  if (owned !== unique.length) {
    throw new HttpError(404, 'Goal not found');
  }
}

export async function assertTasksOwned(userId: string, taskIds: string[]): Promise<void> {
  const unique = [...new Set(taskIds)];
  if (unique.length === 0) return;
  const owned = await prisma.task.count({ where: { id: { in: unique }, userId } });
  if (owned !== unique.length) {
    throw new HttpError(404, 'Task not found');
  }
}
