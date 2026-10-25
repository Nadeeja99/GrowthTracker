// Daily caps on coach messages, so a bug, a heavy user or a flood of sign-ups
// can't run up the AI bill. Failed calls don't count against the user.
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { DEMO_EMAIL } from '../../config/demo';
import { dateKeyInZone, startOfDayInZone } from '../../utils/dates';

const COUNTED = ['pending', 'ok', 'aborted'];

export interface CoachQuota {
  used: number;
  limit: number;
  remaining: number;
}

export async function userQuota(user: { id: string; email: string; timezone: string }): Promise<CoachQuota> {
  const limit = user.email === DEMO_EMAIL ? env.AI_DEMO_DAILY_LIMIT : env.AI_DAILY_LIMIT;
  const since = startOfDayInZone(dateKeyInZone(new Date(), user.timezone), user.timezone);
  const used = await prisma.aiUsage.count({ where: { userId: user.id, createdAt: { gte: since }, status: { in: COUNTED } } });
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export async function globalLimitReached(): Promise<boolean> {
  const since = startOfDayInZone(dateKeyInZone(new Date(), 'UTC'), 'UTC');
  const used = await prisma.aiUsage.count({ where: { createdAt: { gte: since }, status: { in: COUNTED } } });
  return used >= env.AI_GLOBAL_DAILY_LIMIT;
}
