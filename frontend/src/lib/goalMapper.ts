import { FocusSession, Goal, GoalInput, ScheduleActivity } from '@/types';
import { BackendGoal, GoalWritePayload } from '@/lib/api';
import { parseDateKey, toDateKey } from '@/lib/dates';

const PRIORITY_TO_NUMBER: Record<BackendGoal['priority'], number> = {
  LOW: 1, MEDIUM: 2, HIGH: 3,
};

const PRIORITY_TO_CATEGORY: Record<BackendGoal['priority'], Goal['category']> = {
  LOW: 'low', MEDIUM: 'medium', HIGH: 'high',
};

const CATEGORY_TO_PRIORITY: Record<Goal['category'], BackendGoal['priority']> = {
  low: 'LOW', medium: 'MEDIUM', high: 'HIGH',
};

// Calendar-day goal dates are stored as UTC midnight.
const toDayKey = (iso?: string | null) => (iso ? iso.slice(0, 10) : undefined);
const fromDayKey = (key?: string) => (key ? new Date(`${key}T00:00:00.000Z`).toISOString() : undefined);

/** Maps the stored goal. Time stats start at zero; see `applyGoalStats`. */
export function mapBackendGoalToFrontend(backendGoal: BackendGoal): Goal {
  return {
    id: backendGoal.id,
    name: backendGoal.title,
    description: backendGoal.description ?? undefined,
    targetDate: toDayKey(backendGoal.targetDate),
    milestones: (backendGoal.milestones ?? []).map(m => ({
      id: m.id,
      title: m.title,
      completed: m.completed,
      targetDate: toDayKey(m.targetDate),
    })),
    color: backendGoal.color,
    category: PRIORITY_TO_CATEGORY[backendGoal.priority] ?? 'medium',
    targetHoursWeekly: backendGoal.targetHoursWeekly,
    targetHoursDaily: backendGoal.targetHoursDaily,
    currentWeeklyHours: 0,
    streakDays: 0,
    createdAt: backendGoal.createdAt,
    priority: PRIORITY_TO_NUMBER[backendGoal.priority] ?? 2,
    status: backendGoal.status,
    progress: backendGoal.progress,
  };
}

const blockHours = (a: ScheduleActivity) =>
  (new Date(`2000-01-01T${a.endTime}`).getTime() - new Date(`2000-01-01T${a.startTime}`).getTime()) / 3_600_000;

/**
 * Derives "actual" time for a goal from completed schedule blocks plus logged
 * focus sessions, and the streak of consecutive days with any such time.
 */
export function applyGoalStats(goal: Goal, activities: ScheduleActivity[], focusSessions: FocusSession[]): Goal {
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const sessions = focusSessions.filter(s => s.goalId === goal.id);
  // A block someone focused in counts its focused time (via the sessions),
  // not its planned duration, so the same hour is never counted twice.
  const focusedBlockIds = new Set(focusSessions.flatMap(s => (s.scheduleId ? [s.scheduleId] : [])));
  const blocks = activities.filter(a => a.goalId === goal.id && a.status === 'completed' && !focusedBlockIds.has(a.id));

  const weeklyHours =
    blocks.filter(a => parseDateKey(a.date) >= startOfWeek).reduce((sum, a) => sum + blockHours(a), 0) +
    sessions.filter(s => new Date(s.startedAt) >= startOfWeek).reduce((sum, s) => sum + s.durationSeconds / 3600, 0);

  const activeDays = new Set([
    ...blocks.map(a => a.date),
    ...sessions.map(s => toDateKey(new Date(s.startedAt))),
  ]);
  let streak = 0;
  const day = new Date();
  // Today without activity yet doesn't break the streak.
  if (!activeDays.has(toDateKey(day))) day.setDate(day.getDate() - 1);
  while (activeDays.has(toDateKey(day))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }

  return { ...goal, currentWeeklyHours: weeklyHours, streakDays: streak };
}

export function mapGoalInputToBackend(input: GoalInput): GoalWritePayload & { title: string } {
  return {
    title: input.name,
    description: input.description?.trim() || undefined,
    targetDate: fromDayKey(input.targetDate),
    priority: CATEGORY_TO_PRIORITY[input.category] ?? 'MEDIUM',
    color: input.color,
    targetHoursWeekly: input.targetHoursWeekly,
    targetHoursDaily: input.targetHoursDaily,
  };
}

/** Sends only the fields present in `updates`, so other fields are never reset. */
export function mapGoalUpdateToBackend(updates: Partial<GoalInput & Pick<Goal, 'status' | 'progress'>>): GoalWritePayload {
  const result: GoalWritePayload = {};
  if (updates.name !== undefined) result.title = updates.name;
  if (updates.description !== undefined) result.description = updates.description.trim() || null;
  if (updates.targetDate !== undefined) result.targetDate = fromDayKey(updates.targetDate) ?? null;
  if (updates.category !== undefined) result.priority = CATEGORY_TO_PRIORITY[updates.category];
  if (updates.color !== undefined) result.color = updates.color;
  if (updates.targetHoursWeekly !== undefined) result.targetHoursWeekly = updates.targetHoursWeekly;
  if (updates.targetHoursDaily !== undefined) result.targetHoursDaily = updates.targetHoursDaily;
  if (updates.status !== undefined) result.status = updates.status;
  if (updates.progress !== undefined) result.progress = updates.progress;
  return result;
}
