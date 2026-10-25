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
