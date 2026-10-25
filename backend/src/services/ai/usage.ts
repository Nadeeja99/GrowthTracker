// Daily caps on AI requests, so a bug, a heavy user or a flood of sign-ups
// can't run up the bill. All AI features share one budget per user; failed
// calls don't count against it.
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { DEMO_EMAIL } from '../../config/demo';
import { dateKeyInZone, startOfDayInZone } from '../../utils/dates';

export type AiFeature = 'coach' | 'weekly_review' | 'week_plan' | 'goal_breakdown';

const COUNTED = ['pending', 'ok', 'aborted'];

export interface AiQuota {
  used: number;
  limit: number;
  remaining: number;
}

export async function userQuota(user: { id: string; email: string; timezone: string }): Promise<AiQuota> {
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
