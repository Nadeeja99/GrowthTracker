// AI weekly review: wins, slips, patterns between how the user felt (daily
// reviews) and what got done, and priorities for next week. Stored per week so
// it is generated once, not on every visit.
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { HttpError } from '../../utils/httpError';
import { addDays, dateKeyInZone, dateOnly, startOfDayInZone } from '../../utils/dates';
import { clip, dataBlock, goalTimeMs, hours } from '../ai/data';
import { assertAiReady } from '../ai/request';
import { generateStructured } from '../ai/structured';
import { nullable, weekStartKey } from '../ai/time';

type User = { id: string; email: string; timezone: string };

const MAX_ITEMS = 3;

export const weeklyReviewJsonSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'One sentence that sums up the week, with a number from the data' },
    wins: { type: 'array', items: { type: 'string' }, description: 'Up to 3 specific wins' },
    slips: { type: 'array', items: { type: 'string' }, description: 'Up to 3 things that slipped, stated kindly and specifically' },
    patterns: {
      type: 'array',
      description: 'Up to 3 patterns linking daily reviews (energy, mood, performance, notes) or weekdays to what got done. Empty if the data is too thin.',
      items: {
        type: 'object',
        properties: {
          observation: { type: 'string', description: 'e.g. "Low-energy days are when runs get skipped"' },
          evidence: { type: 'string', description: 'The days and numbers it is based on' },
        },
        required: ['observation', 'evidence'],
        additionalProperties: false,
      },
    },
    priorities: {
      type: 'array',
      description: 'Up to 3 priorities for next week',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short and actionable; it may be added as a task' },
          why: { type: 'string', description: 'One sentence, tied to the data' },
          goalId: nullable('string', 'id of the related goal, or null'),
        },
        required: ['title', 'why', 'goalId'],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'wins', 'slips', 'patterns', 'priorities'],
  additionalProperties: false,
} as const;

export const weeklyReviewSchema = z.object({
  headline: z.string(),
  wins: z.array(z.string()),
  slips: z.array(z.string()),
  patterns: z.array(z.object({ observation: z.string(), evidence: z.string() })),
  priorities: z.array(z.object({ title: z.string(), why: z.string(), goalId: z.string().nullable() })),
});

export type WeeklyReviewContent = z.infer<typeof weeklyReviewSchema>;

/** Clips text, caps list lengths and unlinks goals the user doesn't own. */
export function normalizeWeeklyReview(raw: WeeklyReviewContent, goalIds: Set<string>): WeeklyReviewContent {
  const list = (items: string[]) => items.map(item => clip(item, 240)).filter((x): x is string => !!x).slice(0, MAX_ITEMS);
  return {
    headline: clip(raw.headline, 200) ?? '',
    wins: list(raw.wins),
    slips: list(raw.slips),
    patterns: raw.patterns
      .map(p => ({ observation: clip(p.observation, 200) ?? '', evidence: clip(p.evidence, 240) ?? '' }))
      .filter(p => p.observation)
      .slice(0, MAX_ITEMS),
    priorities: raw.priorities
      .map(p => ({ title: clip(p.title, 100) ?? '', why: clip(p.why, 240) ?? '', goalId: p.goalId && goalIds.has(p.goalId) ? p.goalId : null }))
      .filter(p => p.title)
      .slice(0, MAX_ITEMS),
  };
}

const instructions = `You write the weekly review in GrowthTracker, a personal planning app.
Review the user's week from the data: what went well, what slipped, and patterns worth knowing.
- Be specific: name goals, days and numbers. Never invent data; leave a list empty rather than guess.
- Patterns must connect two things in the data (e.g. energy scores and skipped blocks, or weekdays and focus time), with the evidence. With fewer than 3 daily reviews, only note patterns that are very clear.
- Priorities are for next week, concrete enough to become tasks, and tied to goals that are behind target where possible. Use goal ids exactly as given.
- Tone: supportive and honest, like a good coach. Plain sentences, no emoji.
- The week may still be in progress ("daysSoFar" < 7); judge it fairly.`;

/** Gathers one week of data (Sunday to Saturday, up to now) for the review. */
export async function buildWeekData(user: User, weekStart: string, now = new Date()) {
  const tz = user.timezone;
  const start = startOfDayInZone(weekStart, tz);
  const end = new Date(Math.min(startOfDayInZone(addDays(weekStart, 7), tz).getTime(), now.getTime()));
  const previousStart = startOfDayInZone(addDays(weekStart, -7), tz);

  const [goals, blocks, focus, tasksDone, overdue, habits, reflections] = await Promise.all([
    prisma.goal.findMany({ where: { userId: user.id, status: 'ACTIVE' }, take: 20, orderBy: { createdAt: 'asc' } }),
    prisma.schedule.findMany({
      where: { userId: user.id, startTime: { gte: previousStart, lt: end } },
      select: { id: true, goalId: true, status: true, startTime: true, endTime: true },
    }),
    prisma.focusSession.findMany({
      where: { userId: user.id, startedAt: { gte: previousStart, lt: end } },
      select: { goalId: true, scheduleId: true, durationSeconds: true, startedAt: true },
    }),
    prisma.task.findMany({
      where: { userId: user.id, status: 'COMPLETED', completedAt: { gte: start, lt: end } },
      select: { title: true, completedAt: true },
      take: 30,
    }),
    prisma.task.findMany({
      where: { userId: user.id, status: { in: ['PENDING', 'IN_PROGRESS'] }, dueDate: { lt: dateOnly(dateKeyInZone(end, tz)) } },
      select: { title: true },
      take: 5,
    }),
    prisma.habit.findMany({
      where: { userId: user.id },
      include: { completions: { where: { date: { gte: dateOnly(weekStart), lt: dateOnly(addDays(weekStart, 7)) } }, select: { date: true } } },
      take: 20,
    }),
    prisma.reflection.findMany({ where: { userId: user.id, date: { gte: dateOnly(weekStart), lt: dateOnly(addDays(weekStart, 7)) } } }),
  ]);

  const inWeek = <T>(items: T[], at: (item: T) => Date) => items.filter(item => at(item) >= start);
  const weekBlocks = inWeek(blocks, b => b.startTime);
  const weekFocus = inWeek(focus, f => f.startedAt);
  const lastWeekTime = goalTimeMs(blocks.filter(b => b.startTime < start), focus.filter(f => f.startedAt < start));
  const thisWeekTime = goalTimeMs(weekBlocks, weekFocus);
  const dayKey = (date: Date) => dateKeyInZone(date, tz);
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' });

  const days = [];
  for (let key = weekStart; key <= dayKey(new Date(end.getTime() - 1)) && key < addDays(weekStart, 7); key = addDays(key, 1)) {
    const dayBlocks = weekBlocks.filter(b => dayKey(b.startTime) === key);
    const review = reflections.find(r => r.date.toISOString().slice(0, 10) === key);
    days.push({
      date: key,
      weekday: weekday.format(startOfDayInZone(key, tz)),
      blocksPlanned: dayBlocks.length,
      blocksCompleted: dayBlocks.filter(b => b.status === 'COMPLETED').length,
      blocksSkipped: dayBlocks.filter(b => b.status === 'SKIPPED').length,
      focusMinutes: Math.round(weekFocus.filter(f => dayKey(f.startedAt) === key).reduce((sum, f) => sum + f.durationSeconds, 0) / 60),
      tasksCompleted: tasksDone.filter(t => t.completedAt && dayKey(t.completedAt) === key).length,
      habitsDone: habits.filter(h => h.completions.some(c => c.date.toISOString().slice(0, 10) === key)).length,
      review: review ? { performance: review.performance ?? undefined, energy: review.energy ?? undefined, mood: review.mood ?? undefined, notes: clip(review.notes, 200) } : undefined,
    });
  }

  const data = {
    week: { start: weekStart, end: addDays(weekStart, 6), daysSoFar: days.length, timezone: tz },
    goals: goals.map(g => ({
      id: g.id,
      title: clip(g.title, 100),
      priority: g.priority,
      targetHoursPerWeek: g.targetHoursWeekly,
      hoursThisWeek: hours(thisWeekTime.get(g.id) ?? 0),
      hoursLastWeek: hours(lastWeekTime.get(g.id) ?? 0),
      progressPercent: g.progress,
    })),
    days,
    tasksCompleted: tasksDone.slice(0, 10).map(t => clip(t.title, 80)),
    overdueTasks: overdue.map(t => clip(t.title, 80)),
    habits: habits.map(h => ({ name: clip(h.name, 80), frequency: h.frequency, daysDone: h.completions.length })),
  };
  const hasActivity = weekBlocks.length + weekFocus.length + tasksDone.length + reflections.length > 0;
  return { data, goalIds: new Set(goals.map(g => g.id)), hasActivity };
}

/** The Sunday a review may be requested for: this week or any earlier one. */
export function assertReviewableWeek(weekStart: string, timezone: string): void {
  if (weekStartKey(weekStart) !== weekStart) throw new HttpError(400, 'weekStart must be a Sunday');
  if (weekStart > weekStartKey(dateKeyInZone(new Date(), timezone))) throw new HttpError(400, 'That week hasn’t started yet');
}

export async function generateWeeklyReview(user: User, weekStart: string) {
  assertReviewableWeek(weekStart, user.timezone);
  await assertAiReady(user.id);
  const { data, goalIds, hasActivity } = await buildWeekData(user, weekStart);
  if (!hasActivity) throw new HttpError(422, 'There’s nothing to review for this week yet. Complete a block or save a daily review first.');

  const { value: raw, model } = await generateStructured({
    user,
    feature: 'weekly_review',
    instructions,
    input: dataBlock(data),
    schemaName: 'weekly_review',
    jsonSchema: weeklyReviewJsonSchema as unknown as Record<string, unknown>,
    validator: weeklyReviewSchema,
    maxOutputTokens: 2500,
  });
  const content = normalizeWeeklyReview(raw, goalIds);

  const saved = await prisma.weeklyReview.upsert({
    where: { userId_weekStart: { userId: user.id, weekStart: dateOnly(weekStart) } },
    create: { userId: user.id, weekStart: dateOnly(weekStart), content: content as unknown as Prisma.InputJsonValue, model },
    update: { content: content as unknown as Prisma.InputJsonValue, model },
  });
  return serializeReview(saved);
}

export function serializeReview(review: { weekStart: Date; content: unknown; updatedAt: Date }) {
  return { weekStart: review.weekStart.toISOString().slice(0, 10), content: review.content as WeeklyReviewContent, generatedAt: review.updatedAt };
}
