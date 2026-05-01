import { Habit, HabitCompletion } from '@/types';
import { BackendHabit, BackendHabitWithCompletions, BackendHabitCompletion } from '@/lib/api';

function computeStreak(completions: BackendHabitCompletion[]): number {
  if (completions.length === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedDates = new Set(
    completions.map(c => new Date(c.date).toISOString().split('T')[0])
  );
  let streak = 0;
  const check = new Date(today);
  while (true) {
    const key = check.toISOString().split('T')[0];
    if (completedDates.has(key)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function mapBackendHabitToFrontend(backendHabit: BackendHabitWithCompletions): Habit {
  const today = new Date().toISOString().split('T')[0];
  const completions: HabitCompletion[] = (backendHabit.completions || []).map(c => ({
    id: c.id,
    date: c.date,
    count: c.count,
    notes: c.notes,
    habitId: c.habitId,
  }));
  const completedToday = completions.some(c => c.date.split('T')[0] === today);
  const streak = computeStreak(backendHabit.completions || []);
  return {
    id: backendHabit.id,
    name: backendHabit.name,
    description: backendHabit.description,
    frequency: backendHabit.frequency.toLowerCase() as Habit['frequency'],
    targetCount: backendHabit.targetCount,
    createdAt: backendHabit.createdAt,
    completions,
    streak,
    completedToday,
    totalCompletions: backendHabit._count?.completions ?? completions.length,
  };
}

export function mapBackendHabitListToFrontend(habit: BackendHabit): Habit {
  return mapBackendHabitToFrontend({ ...habit, completions: [] });
}
