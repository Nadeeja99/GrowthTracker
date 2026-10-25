import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FocusSession, Goal, ScheduleActivity } from '@/types';
import type { BackendHabitWithCompletions, BackendReflection } from '@/lib/api';
import { parseDateKey, toDateKey } from './dates';
import { applyGoalStats, mapGoalUpdateToBackend } from './goalMapper';
import { mapBackendHabitToFrontend } from './habitMapper';
import { mapFrontendTaskToBackend, mapFrontendTaskUpdateToBackend } from './taskMapper';
import { mapBackendReflectionToRating, mapRatingToReflectionPayload } from './reflectionMapper';

// Wednesday 28 Oct 2026, 15:00 local time.
const NOW = new Date(2026, 9, 28, 15, 0, 0);
const keyDaysAgo = (n: number) => { const d = new Date(NOW); d.setDate(d.getDate() - n); return toDateKey(d); };
afterEach(() => vi.useRealTimers());

describe('date keys', () => {
  it('uses the local calendar day, not the UTC one', () => {
    // 00:30 local is still "yesterday" in UTC for zones east of UTC; the key must not shift.
    expect(toDateKey(new Date(2026, 9, 28, 0, 30))).toBe('2026-10-28');
    expect(toDateKey(new Date(2026, 9, 28, 23, 59))).toBe('2026-10-28');
  });

  it('parses a key as local midnight', () => {
    const d = parseDateKey('2026-10-28');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 28, 0]);
  });
});

describe('goal stats', () => {
  const goal = { id: 'g1', currentWeeklyHours: 0, streakDays: 0 } as Goal;
  const block = (id: string, date: string, status: ScheduleActivity['status'] = 'completed'): ScheduleActivity =>
    ({ id, goalId: 'g1', title: 'Deep work', date, startTime: '09:00', endTime: '11:00', status });
  const session = (startedAt: Date, minutes: number, scheduleId?: string): FocusSession =>
    ({ id: `s${startedAt.getTime()}`, goalId: 'g1', scheduleId, startedAt: startedAt.toISOString(), endedAt: startedAt.toISOString(), durationSeconds: minutes * 60, plannedSeconds: 1500, completed: true });

  it('adds completed blocks and focus sessions this week', () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const stats = applyGoalStats(goal, [block('b1', keyDaysAgo(1)), block('b2', keyDaysAgo(0), 'pending')], [session(new Date(2026, 9, 28, 8), 30)]);
    expect(stats.currentWeeklyHours).toBeCloseTo(2.5); // 2h block + 0.5h focus; pending block ignored
  });

  it('counts focused time instead of the planned block when a session ran inside it (no double counting)', () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const stats = applyGoalStats(goal, [block('b1', keyDaysAgo(1))], [session(new Date(2026, 9, 27, 9), 50, 'b1')]);
    expect(stats.currentWeeklyHours).toBeCloseTo(50 / 60);
  });

  it('keeps a streak alive when today has no activity yet', () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const stats = applyGoalStats(goal, [block('b1', keyDaysAgo(1)), block('b2', keyDaysAgo(2)), block('b3', keyDaysAgo(4))], []);
    expect(stats.streakDays).toBe(2);
  });

  it('sends only the fields that changed (no reset of other settings)', () => {
    expect(mapGoalUpdateToBackend({ color: '#EF4444' })).toEqual({ color: '#EF4444' });
    expect(mapGoalUpdateToBackend({ description: '  ' })).toEqual({ description: null });
  });
});

describe('habit streaks', () => {
  const habit = (dates: string[]): BackendHabitWithCompletions => ({
    id: 'h1', name: 'Read', frequency: 'DAILY', targetCount: 1, userId: 'u', createdAt: '', updatedAt: '',
    completions: dates.map((date, i) => ({ id: `c${i}`, date: `${date}T00:00:00.000Z`, count: 1, habitId: 'h1', createdAt: '' })),
  });

  it('counts back from yesterday when today is not done yet', () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const h = mapBackendHabitToFrontend(habit([keyDaysAgo(1), keyDaysAgo(2), keyDaysAgo(4)]));
    expect(h.streak).toBe(2);
    expect(h.completedToday).toBe(false);
  });

  it('includes today once it is done', () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const h = mapBackendHabitToFrontend(habit([keyDaysAgo(0), keyDaysAgo(1)]));
    expect(h.streak).toBe(2);
    expect(h.completedToday).toBe(true);
  });
});

describe('task mapping', () => {
  it('sends new subtasks without an id and keeps existing ids', () => {
    const payload = mapFrontendTaskToBackend({
      title: 't', priority: 'high', status: 'todo', tags: ['a'],
      subtasks: [{ id: 'keep-me', title: 'old', completed: true }, { title: 'new', completed: false }],
    });
    expect(payload.subtasks).toEqual([{ id: 'keep-me', title: 'old', completed: true }, { title: 'new', completed: false }]);
    expect(payload.priority).toBe('HIGH');
  });

  it('clears a due date with null and unlinks a goal with null', () => {
    expect(mapFrontendTaskUpdateToBackend({ dueDate: '', goalId: '' })).toEqual({ dueDate: null, goalId: null });
  });
});

describe('reflection mapping', () => {
  it('maps "not set" (0 in the UI) to null and back', () => {
    expect(mapRatingToReflectionPayload({ performance: 0, energy: 4, mood: 6, notes: '  ' }))
      .toEqual({ performance: null, energy: 4, mood: null, notes: null });
    const r: BackendReflection = { id: 'r', date: '2026-10-28', performance: null, energy: 3, mood: null, notes: null };
    expect(mapBackendReflectionToRating(r)).toEqual({ date: '2026-10-28', performance: 0, energy: 3, mood: 0, notes: '' });
  });
});
