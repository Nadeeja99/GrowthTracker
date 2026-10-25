import { Goal, ScheduleActivity } from '@/types';
import { parseDateKey, toDateKey } from '@/lib/dates';

interface BackendGoal {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';
  progress: number;
  createdAt: string;
  updatedAt: string;
}

const GOAL_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F97316',
  '#EF4444', '#06B6D4', '#84CC16', '#F59E0B',
  '#EC4899', '#6366F1',
];

const PRIORITY_TO_NUMBER: Record<string, number> = {
  LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4,
};

const PRIORITY_TO_CATEGORY: Record<string, 'high' | 'medium' | 'low'> = {
  LOW: 'low', MEDIUM: 'medium', HIGH: 'high', URGENT: 'high',
};

function parseMetadata(description?: string): { color?: string; targetHoursWeekly?: number; targetHoursDaily?: number } {
  if (!description) return {};
  try {
    const meta = JSON.parse(description);
    if (typeof meta === 'object' && meta !== null) return meta;
  } catch {
    // not JSON
  }
  return {};
}

function computeCurrentWeeklyHours(goalId: string, activities: ScheduleActivity[]): number {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  return activities
    .filter(a => a.goalId === goalId && a.status === 'completed' && parseDateKey(a.date) >= startOfWeek)
    .reduce((total, a) => {
      const start = new Date(`2000-01-01T${a.startTime}`);
      const end = new Date(`2000-01-01T${a.endTime}`);
      return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }, 0);
}

function computeStreakDays(goalId: string, activities: ScheduleActivity[]): number {
  const completedDates = new Set(
    activities
      .filter(a => a.goalId === goalId && a.status === 'completed')
      .map(a => a.date)
  );

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = toDateKey(d);
    if (completedDates.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}

export function mapBackendGoalToFrontend(backendGoal: BackendGoal, activities: ScheduleActivity[] = []): Goal {
  const meta = parseMetadata(backendGoal.description);
  const colorIndex = parseInt(backendGoal.id.slice(-1), 16) % GOAL_COLORS.length;

  return {
    id: backendGoal.id,
    name: backendGoal.title,
    color: meta.color ?? GOAL_COLORS[colorIndex],
    category: PRIORITY_TO_CATEGORY[backendGoal.priority] ?? 'medium',
    targetHoursWeekly: meta.targetHoursWeekly ?? 10,
    targetHoursDaily: meta.targetHoursDaily ?? 1.5,
    currentWeeklyHours: computeCurrentWeeklyHours(backendGoal.id, activities),
    streakDays: computeStreakDays(backendGoal.id, activities),
    createdAt: backendGoal.createdAt,
    priority: PRIORITY_TO_NUMBER[backendGoal.priority] ?? 2,
    status: backendGoal.status,
    progress: backendGoal.progress,
  };
}

export function mapFrontendGoalToBackend(frontendGoal: {
  name: string;
  category: 'high' | 'medium' | 'low';
  targetHoursWeekly?: number;
  targetHoursDaily?: number;
  color?: string;
  priority?: number;
}): { title: string; description?: string; priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' } {
  const categoryToPriority: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'> = {
    low: 'LOW', medium: 'MEDIUM', high: 'HIGH',
  };

  let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = categoryToPriority[frontendGoal.category] ?? 'MEDIUM';
  if (frontendGoal.priority !== undefined) {
    if (frontendGoal.priority >= 4) priority = 'URGENT';
    else if (frontendGoal.priority >= 3) priority = 'HIGH';
    else if (frontendGoal.priority >= 2) priority = 'MEDIUM';
    else priority = 'LOW';
  }

  const description = JSON.stringify({
    targetHoursWeekly: frontendGoal.targetHoursWeekly ?? 10,
    targetHoursDaily: frontendGoal.targetHoursDaily ?? 1.5,
    color: frontendGoal.color ?? '#3B82F6',
  });

  return { title: frontendGoal.name, description, priority };
}

export function mapFrontendGoalUpdateToBackend(updates: Partial<Goal>): {
  title?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status?: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';
  progress?: number;
} {
  const result: any = {};

  if (updates.name !== undefined) result.title = updates.name;
  if (updates.status !== undefined) result.status = updates.status;
  if (updates.progress !== undefined) result.progress = updates.progress;

  if (updates.color !== undefined || updates.targetHoursWeekly !== undefined || updates.targetHoursDaily !== undefined) {
    result.description = JSON.stringify({
      targetHoursWeekly: updates.targetHoursWeekly ?? 10,
      targetHoursDaily: updates.targetHoursDaily ?? 1.5,
      color: updates.color ?? '#3B82F6',
    });
  }

  if (updates.category !== undefined || updates.priority !== undefined) {
    const categoryToPriority: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'> = {
      low: 'LOW', medium: 'MEDIUM', high: 'HIGH',
    };
    result.priority = updates.category ? categoryToPriority[updates.category] : 'MEDIUM';
    if (updates.priority !== undefined) {
      if (updates.priority >= 4) result.priority = 'URGENT';
      else if (updates.priority >= 3) result.priority = 'HIGH';
      else if (updates.priority >= 2) result.priority = 'MEDIUM';
      else result.priority = 'LOW';
    }
  }

  return result;
}
