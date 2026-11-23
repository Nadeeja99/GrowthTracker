import { prisma } from '../../config/database';
import { addDays, dateKeyInZone, minutesIntoDayInZone, startOfDayInZone } from '../../utils/dates';
import { bandOf, BlockInput, MODEL, Outcome, reasons, skipProbability } from './risk';

/**
 * The person's past blocks with a known result, most recent first. A block is
 * kept if it was ticked off or worked on with the focus timer, and missed if
 * it was marked skipped. Unticked blocks are left out rather than counted as
 * missed: plenty of people never tick anything, and treating that as missing
 * everything would flag every block they plan. Results count once a block
 * ended `resolveHours` ago, the same rule the model was evaluated with.
 */
export async function outcomeHistory(userId: string, timezone: string, now = new Date()): Promise<Outcome[]> {
  const blocks = await prisma.schedule.findMany({
    where: {
      userId,
      endTime: { lte: new Date(now.getTime() - MODEL.resolveHours * 3_600_000) },
      status: { in: ['COMPLETED', 'SKIPPED', 'PENDING', 'IN_PROGRESS'] },
    },
    orderBy: { startTime: 'desc' },
    take: MODEL.shrinkage.historyLimit * 4,
    select: { startTime: true, goalId: true, status: true, _count: { select: { focusSessions: true } } },
  });
  const outcomes: Outcome[] = [];
  for (const b of blocks) {
    const kept = b.status === 'COMPLETED' || b._count.focusSessions > 0;
    if (!kept && b.status !== 'SKIPPED') continue;
    outcomes.push({ band: bandOf(MODEL, minutesIntoDayInZone(b.startTime, timezone)), goalId: b.goalId, missed: !kept });
    if (outcomes.length === MODEL.shrinkage.historyLimit) break;
  }
  return outcomes;
}

export interface CandidateBlock {
  id: string;
  startTime: Date;
  endTime: Date;
  /** When it was planned: a saved block's createdAt, or now for a proposal. */
  plannedAt: Date;
  goalId: string | null;
}

export interface BlockRisk {
  id: string;
  probability: number;
  likelyToSlip: boolean;
  reasons: string[];
}

/**
 * Skip risk for each candidate. Saved candidates are already among the day's
 * blocks; `proposed` candidates (from Plan my week) are added to their days,
 * so a crowded proposal counts as a crowded day. `risks` is null while the
 * person has too little history for a fair estimate.
 */
export async function blockRisks(
  user: { id: string; timezone: string },
  candidates: CandidateBlock[],
  { proposed = false, now = new Date() } = {}
): Promise<{ risks: BlockRisk[] | null; history: number }> {
  const history = await outcomeHistory(user.id, user.timezone, now);
  if (history.length < MODEL.minHistory) return { risks: null, history: history.length };
  if (candidates.length === 0) return { risks: [], history: history.length };

  const dayOf = (instant: Date) => dateKeyInZone(instant, user.timezone);
  const days = [...new Set(candidates.map(c => dayOf(c.startTime)))].sort();
  const existing = await prisma.schedule.findMany({
    where: {
      userId: user.id,
      status: { not: 'RESCHEDULED' },
      startTime: { gte: startOfDayInZone(days[0], user.timezone), lt: startOfDayInZone(addDays(days[days.length - 1], 1), user.timezone) },
    },
    select: { id: true, startTime: true },
  });
  const perDay = new Map<string, number>();
  const count = (instant: Date) => perDay.set(dayOf(instant), (perDay.get(dayOf(instant)) ?? 0) + 1);
  existing.forEach(b => count(b.startTime));
  if (proposed) candidates.forEach(c => count(c.startTime));

  const risks = candidates.map(c => {
    const day = dayOf(c.startTime);
    const input: BlockInput = {
      startMinutes: minutesIntoDayInZone(c.startTime, user.timezone),
      weekday: new Date(`${day}T00:00:00Z`).getUTCDay(),
      durationMinutes: (c.endTime.getTime() - c.startTime.getTime()) / 60_000,
      leadHours: (c.startTime.getTime() - c.plannedAt.getTime()) / 3_600_000,
      // Every candidate is in its day's count, so "other blocks" leaves it out.
      dayLoad: Math.max((perDay.get(day) ?? 0) - 1, 0),
      goalId: c.goalId,
    };
    const probability = skipProbability(MODEL, input, history);
    const likelyToSlip = probability >= MODEL.threshold;
    return {
      id: c.id,
      probability: Math.round(probability * 100) / 100,
      likelyToSlip,
      reasons: likelyToSlip ? reasons(MODEL, input, history) : [],
    };
  });
  return { risks, history: history.length };
}
