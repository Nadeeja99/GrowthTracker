// A compact snapshot of the user's plan and recent history for the coach.
// Only what coaching needs is included: no email, password or account data,
// and free text (titles, review notes) is clipped.
import { prisma } from '../../config/database';
import { addDays, dateKeyInZone, startOfDayInZone } from '../../utils/dates';

const HISTORY_DAYS = 7;
const UPCOMING_DAYS = 3;
const MAX_TASKS = 15;
const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

const clip = (text: string | null | undefined, max: number) =>
  text ? text.trim().replace(/\s+/g, ' ').slice(0, max) : undefined;

const hours = (ms: number) => Math.round((ms / 3_600_000) * 10) / 10;

export interface CoachContext {
  todayKey: string;
  timezone: string;
  /** Ids of the goals the model may link suggestions to. */
  goalIds: Set<string>;
  /** JSON snapshot placed in the prompt. */
  snapshot: string;
}

export async function buildCoachContext(userId: string, timezone: string, now = new Date()): Promise<CoachContext> {
  const todayKey = dateKeyInZone(now, timezone);
  const historyStart = startOfDayInZone(addDays(todayKey, -HISTORY_DAYS), timezone);
  const upcomingEnd = startOfDayInZone(addDays(todayKey, UPCOMING_DAYS), timezone);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'long' });

  const [user, goals, blocks, tasks, habits, reflections, focus] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true } }),
    prisma.goal.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { milestones: { where: { completed: false }, orderBy: { createdAt: 'asc' }, take: 3, select: { title: true } } },
      orderBy: { createdAt: 'asc' },
      take: 20,
    }),
    prisma.schedule.findMany({
      where: { userId, startTime: { gte: historyStart, lt: upcomingEnd } },
      select: { id: true, title: true, startTime: true, endTime: true, status: true, goalId: true },
      orderBy: { startTime: 'asc' },
      take: 300,
    }),
    prisma.task.findMany({
      where: { userId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      select: { title: true, priority: true, dueDate: true, estimatedTime: true, goalId: true, status: true },
      take: 200,
    }),
    prisma.habit.findMany({
      where: { userId },
      include: { completions: { where: { date: { gte: new Date(`${addDays(todayKey, -(HISTORY_DAYS - 1))}T00:00:00Z`) } }, select: { date: true } } },
      take: 20,
    }),
    prisma.reflection.findMany({
      where: { userId, date: { gte: new Date(`${addDays(todayKey, -HISTORY_DAYS)}T00:00:00Z`) } },
      orderBy: { date: 'asc' },
    }),
    prisma.focusSession.findMany({
      where: { userId, startedAt: { gte: historyStart } },
      select: { durationSeconds: true, goalId: true, scheduleId: true },
    }),
  ]);

  const goalTitle = new Map(goals.map(g => [g.id, g.title]));
  const past = blocks.filter(b => b.startTime < now);

  // Hours per goal over the last 7 days: completed blocks, plus focus sessions
  // not tied to a block. Focus inside a block replaces the block's planned time.
  const focusedBlocks = new Set(focus.map(f => f.scheduleId).filter(Boolean));
  const doneMs = new Map<string, number>();
  const addDone = (goalId: string | null, ms: number) => {
    if (goalId) doneMs.set(goalId, (doneMs.get(goalId) ?? 0) + ms);
  };
  for (const b of past) {
    if (b.status === 'COMPLETED' && !focusedBlocks.has(b.id)) addDone(b.goalId, b.endTime.getTime() - b.startTime.getTime());
  }
  for (const f of focus) addDone(f.goalId, f.durationSeconds * 1000);

  const openTasks = tasks
    .sort((a, b) =>
      (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, MAX_TASKS);

  const snapshot = {
    now: { date: todayKey, weekday: weekday.format(now), time: time.format(now), timezone },
    user: { firstName: user.firstName ?? undefined },
    goals: goals.map(g => ({
      id: g.id,
      title: clip(g.title, 100),
      priority: g.priority,
      progressPercent: g.progress,
      targetHoursPerWeek: g.targetHoursWeekly,
      hoursLast7Days: hours(doneMs.get(g.id) ?? 0),
      targetDate: g.targetDate?.toISOString().slice(0, 10),
      nextMilestones: g.milestones.map(m => clip(m.title, 80)),
    })),
    last7Days: {
      blocksPlanned: past.length,
      blocksCompleted: past.filter(b => b.status === 'COMPLETED').length,
      blocksSkipped: past.filter(b => b.status === 'SKIPPED').length,
      focusSessions: focus.length,
      focusMinutes: Math.round(focus.reduce((sum, f) => sum + f.durationSeconds, 0) / 60),
    },
    upcomingBlocks: blocks
      .filter(b => b.endTime >= now)
      .slice(0, 25)
      .map(b => ({
        date: dateKeyInZone(b.startTime, timezone),
        start: time.format(b.startTime),
        end: time.format(b.endTime),
        title: clip(b.title, 80),
        status: b.status,
        goal: b.goalId ? goalTitle.get(b.goalId) : undefined,
      })),
    openTasks: openTasks.map(t => {
      const due = t.dueDate?.toISOString().slice(0, 10);
      return {
        title: clip(t.title, 100),
        priority: t.priority,
        due,
        overdue: due ? due < todayKey : undefined,
        inProgress: t.status === 'IN_PROGRESS' || undefined,
        estimateMinutes: t.estimatedTime ?? undefined,
        goal: t.goalId ? goalTitle.get(t.goalId) : undefined,
      };
    }),
    habits: habits.map(h => {
      const days = new Set(h.completions.map(c => c.date.toISOString().slice(0, 10)));
      return { name: clip(h.name, 80), frequency: h.frequency, daysDoneLast7: days.size, doneToday: days.has(todayKey) };
    }),
    dailyReviews: reflections.map(r => ({
      date: r.date.toISOString().slice(0, 10),
      performance: r.performance ?? undefined,
      energy: r.energy ?? undefined,
      mood: r.mood ?? undefined,
      notes: clip(r.notes, 200),
    })),
  };

  return { todayKey, timezone, goalIds: new Set(goals.map(g => g.id)), snapshot: JSON.stringify(snapshot) };
}
