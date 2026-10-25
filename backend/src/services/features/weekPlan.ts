// "Plan my week": the AI proposes time blocks that move each goal towards its
// weekly target, in free time inside a window the user chooses. Nothing is
// saved here; the user reviews the proposal and adds what they want.
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { HttpError } from '../../utils/httpError';
import { addDays, dateKeyInZone, startOfDayInZone, zonedTimeToInstant } from '../../utils/dates';
import { clip, dataBlock, goalTimeMs, hours } from '../ai/data';
import { assertAiReady } from '../ai/request';
import { generateStructured } from '../ai/structured';
import { isDateKey, minutesOfDay, nullable, weekStartKey } from '../ai/time';

type User = { id: string; email: string; timezone: string };

const MAX_BLOCKS = 21;
const MAX_PER_DAY = 4;
const MIN_MINUTES = 15;
const MAX_MINUTES = 180;

export const weekPlanJsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'One or two sentences: the idea behind the plan' },
    blocks: {
      type: 'array',
      description: `Up to ${MAX_BLOCKS} time blocks`,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Specific, e.g. "AWS: VPC practice questions"' },
          goalId: nullable('string', 'id of the goal this block serves, or null'),
          date: { type: 'string', description: 'YYYY-MM-DD' },
          startTime: { type: 'string', description: '24h HH:MM, local time' },
          durationMinutes: { type: 'integer', description: `${MIN_MINUTES} to ${MAX_MINUTES}` },
          reason: { type: 'string', description: 'Short: why this block, why then' },
        },
        required: ['title', 'goalId', 'date', 'startTime', 'durationMinutes', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'blocks'],
  additionalProperties: false,
} as const;

export const weekPlanSchema = z.object({
  summary: z.string(),
  blocks: z.array(z.object({
    title: z.string(),
    goalId: z.string().nullable(),
    date: z.string(),
    startTime: z.string(),
    durationMinutes: z.number().int(),
    reason: z.string(),
  })),
});

export interface PlannedBlock {
  id: string;
  title: string;
  goalId: string | null;
  startTime: string;
  endTime: string;
  reason: string;
}

interface Interval { start: number; end: number }
const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export interface PlanRules {
  timezone: string;
  /** Dates the plan may use (today onwards, within the week). */
  days: string[];
  window: { start: number; end: number };
  busy: Interval[];
  goalIds: Set<string>;
  now: Date;
}

/**
 * Keeps only blocks that can really be added: on an allowed day, inside the
 * window, in the future, not overlapping existing blocks or each other, and
 * within per-day and total limits. Durations are clamped, and goals the user
 * doesn't own are unlinked.
 */
export function normalizeWeekPlan(raw: z.infer<typeof weekPlanSchema>, rules: PlanRules): { summary: string; blocks: PlannedBlock[] } {
  const taken = [...rules.busy];
  const perDay = new Map<string, number>();
  const blocks: PlannedBlock[] = [];

  for (const block of raw.blocks) {
    const title = clip(block.title, 100);
    const minutes = minutesOfDay(block.startTime);
    if (!title || minutes === null || !isDateKey(block.date) || !rules.days.includes(block.date)) continue;
    const duration = Math.min(Math.max(block.durationMinutes, MIN_MINUTES), MAX_MINUTES);
    if (minutes < rules.window.start || minutes + duration > rules.window.end) continue;
    if ((perDay.get(block.date) ?? 0) >= MAX_PER_DAY) continue;

    const start = zonedTimeToInstant(block.date, minutes, rules.timezone);
    const interval = { start: start.getTime(), end: start.getTime() + duration * 60_000 };
    if (start <= rules.now || taken.some(t => overlaps(t, interval))) continue;

    taken.push(interval);
    perDay.set(block.date, (perDay.get(block.date) ?? 0) + 1);
    blocks.push({
      id: randomUUID(),
      title,
      goalId: block.goalId && rules.goalIds.has(block.goalId) ? block.goalId : null,
      startTime: start.toISOString(),
      endTime: new Date(interval.end).toISOString(),
      reason: clip(block.reason, 200) ?? '',
    });
    if (blocks.length === MAX_BLOCKS) break;
  }

  blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { summary: clip(raw.summary, 300) ?? '', blocks };
}

const instructions = `You plan the user's week in GrowthTracker, a personal planning app.
Propose time blocks for the days listed in "plannableDays" that move each goal towards its weekly target.
- Only use free time: inside the window, never overlapping "busy" blocks, and not in the past (see "now").
- Hours still needed per goal = target minus hours done minus hours already planned this week. Don't overshoot; fewer, realistic blocks beat a packed week. Respect goal priority.
- Prefer blocks of 45 to 90 minutes, at most ${MAX_PER_DAY} per day, with breaks between them. Spread a goal across the week rather than cramming one day.
- Where an open task belongs to a goal, name the block after the task.
- Use the user's recent energy (daily reviews) if it shows a pattern, e.g. lighter days after low-energy ones.
- Use goal ids exactly as given. Dates are YYYY-MM-DD and times 24h HH:MM in the user's time zone.
- If nothing is needed (all targets met or no free time), return an empty list and say why in the summary.`;

export async function generateWeekPlan(user: User, weekStart: string, window: { start: string; end: string }) {
  const tz = user.timezone;
  const now = new Date();
  const todayKey = dateKeyInZone(now, tz);
  if (weekStartKey(weekStart) !== weekStart) throw new HttpError(400, 'weekStart must be a Sunday');
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter(day => day >= todayKey);
  if (days.length === 0) throw new HttpError(400, 'That week is already over');
  if (weekStart > addDays(weekStartKey(todayKey), 7)) throw new HttpError(400, 'You can plan this week or next week');

  const windowStart = minutesOfDay(window.start);
  const windowEnd = window.end === '24:00' ? 24 * 60 : minutesOfDay(window.end);
  if (windowStart === null || windowEnd === null || windowEnd - windowStart < 60) {
    throw new HttpError(400, 'Choose a window of at least an hour');
  }
  await assertAiReady(user.id);

  const start = startOfDayInZone(weekStart, tz);
  const end = startOfDayInZone(addDays(weekStart, 7), tz);
  const [goals, blocks, focus, tasks, reflections] = await Promise.all([
    prisma.goal.findMany({ where: { userId: user.id, status: 'ACTIVE' }, take: 20, orderBy: { createdAt: 'asc' } }),
    prisma.schedule.findMany({
      where: { userId: user.id, startTime: { lt: end }, endTime: { gt: start } },
      select: { id: true, title: true, goalId: true, status: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    }),
    prisma.focusSession.findMany({ where: { userId: user.id, startedAt: { gte: start, lt: end } }, select: { goalId: true, scheduleId: true, durationSeconds: true } }),
    prisma.task.findMany({
      where: { userId: user.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      select: { title: true, dueDate: true, estimatedTime: true, goalId: true },
      orderBy: { dueDate: 'asc' },
      take: 15,
    }),
    prisma.reflection.findMany({
      where: { userId: user.id, date: { gte: new Date(`${addDays(todayKey, -14)}T00:00:00Z`) } },
      select: { date: true, energy: true, performance: true },
      orderBy: { date: 'asc' },
    }),
  ]);

  const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const done = goalTimeMs(blocks, focus);
  const plannedMs = new Map<string, number>();
  for (const b of blocks) {
    if (b.goalId && b.status === 'PENDING' && b.startTime > now) {
      plannedMs.set(b.goalId, (plannedMs.get(b.goalId) ?? 0) + b.endTime.getTime() - b.startTime.getTime());
    }
  }
  const active = blocks.filter(b => b.status !== 'SKIPPED');
  const goalTitle = new Map(goals.map(g => [g.id, g.title]));

  const data = {
    now: { date: todayKey, time: time.format(now), timezone: tz },
    plannableDays: days,
    window: { start: window.start, end: window.end },
    goals: goals.map(g => ({
      id: g.id,
      title: clip(g.title, 100),
      priority: g.priority,
      targetHoursPerWeek: g.targetHoursWeekly,
      hoursDone: hours(done.get(g.id) ?? 0),
      hoursAlreadyPlanned: hours(plannedMs.get(g.id) ?? 0),
    })),
    busy: active
      .filter(b => days.includes(dateKeyInZone(b.startTime, tz)))
      .map(b => ({ date: dateKeyInZone(b.startTime, tz), start: time.format(b.startTime), end: time.format(b.endTime), title: clip(b.title, 60) })),
    openTasks: tasks.map(t => ({
      title: clip(t.title, 80),
      due: t.dueDate?.toISOString().slice(0, 10),
      estimateMinutes: t.estimatedTime ?? undefined,
      goal: t.goalId ? goalTitle.get(t.goalId) : undefined,
    })),
    recentEnergy: reflections.filter(r => r.energy != null).map(r => ({ date: r.date.toISOString().slice(0, 10), energy: r.energy, performance: r.performance ?? undefined })),
  };

  const { value } = await generateStructured({
    user,
    feature: 'week_plan',
    instructions,
    input: dataBlock(data),
    schemaName: 'week_plan',
    jsonSchema: weekPlanJsonSchema as unknown as Record<string, unknown>,
    validator: weekPlanSchema,
    maxOutputTokens: 3500,
  });

  return normalizeWeekPlan(value, {
    timezone: tz,
    days,
    window: { start: windowStart, end: windowEnd },
    busy: active.map(b => ({ start: b.startTime.getTime(), end: b.endTime.getTime() })),
    goalIds: new Set(goals.map(g => g.id)),
    now,
  });
}
