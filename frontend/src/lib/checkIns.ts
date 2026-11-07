// Check-ins (a habit done, a task finished, a block ticked off) are written to
// this device first and sent to the server afterwards, online or not. That way
// there's one path to get right, and a phone closing the app, or losing signal,
// straight after a tap can't lose anything. Each one states an outcome rather
// than a change, so sending it twice is harmless; if the same thing is changed
// again before it syncs, the newest choice wins.
import type { QueryClient } from '@tanstack/react-query';
import { ApiError, apiClient } from '@/lib/api';
import { computeStreak } from '@/lib/habitMapper';
import { queryKeys } from '@/lib/queryKeys';
import { mapFrontendActivityUpdateToBackend } from '@/lib/scheduleMapper';
import { mapFrontendTaskUpdateToBackend } from '@/lib/taskMapper';
import { toast } from '@/lib/toast';
import { toDateKey } from '@/lib/dates';
import type { Habit, ScheduleActivity, Task } from '@/types';

export type CheckIn =
  | { kind: 'habit'; id: string; date: string }
  | { kind: 'task'; id: string; status: Task['status']; at: string }
  | { kind: 'block'; id: string; status: ScheduleActivity['status']; date?: string }
  | { kind: 'subtask'; id: string; taskId: string; completed: boolean };

export type QueuedCheckIn = CheckIn & {
  /** Identifies this exact entry, so a newer choice made mid-send isn't lost. */
  entry: string;
  /** Named in the message if the server refuses it. */
  title: string;
  attempts: number;
  queuedAt: number;
};

// A server that keeps failing mustn't hold up everything behind it for ever.
const MAX_ATTEMPTS = 8;
// Longer than a normal save, so the user is told it got through in the end.
const DELAYED_MS = 5000;
const NOTHING: QueuedCheckIn[] = [];

let storageKey: string | null = null;
let queue: QueuedCheckIn[] = NOTHING;
const listeners = new Set<() => void>();

function publish(next: QueuedCheckIn[]) {
  queue = next.length ? next : NOTHING;
  if (storageKey) {
    try {
      if (queue.length) localStorage.setItem(storageKey, JSON.stringify(queue));
      else localStorage.removeItem(storageKey);
    } catch {
      // Storage is off or full: it stays in memory until the app closes.
    }
  }
  listeners.forEach(listener => listener());
}

export const checkInStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => queue,
  getServerSnapshot: () => NOTHING,
};

/** Loads the waiting check-ins of whoever just signed in; null closes the queue. */
export function openCheckIns(userId: string | null): void {
  storageKey = userId && `growthtracker-checkins:${userId}`;
  let saved: QueuedCheckIn[] = NOTHING;
  try {
    if (storageKey) saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
  } catch {
    // Unreadable: nothing to resume.
  }
  queue = saved.length ? saved : NOTHING;
  listeners.forEach(listener => listener());
}

/** Forgets waiting check-ins, for when the user chose to discard them. */
export function discardCheckIns(): void {
  publish(NOTHING);
}

const sameTarget = (a: CheckIn, b: CheckIn) =>
  a.kind === b.kind && a.id === b.id && (a.kind !== 'habit' || a.date === (b as typeof a).date);

export function enqueueCheckIn(checkIn: CheckIn, title: string): void {
  const entry = { ...checkIn, title, attempts: 0, queuedAt: Date.now(), entry: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  publish([...queue.filter(item => !sameTarget(item, checkIn)), entry]);
}

// Applying waiting check-ins on top of data, so the screen keeps showing what
// the user did even when older data arrives from the server or from storage.

export function withPendingTasks(tasks: Task[], pending = queue): Task[] {
  if (!pending.length) return tasks;
  return tasks.map(task => pending.reduce((current, item) => {
    if (item.kind === 'task' && item.id === task.id) {
      return { ...current, status: item.status, completedAt: item.status === 'completed' ? item.at : undefined };
    }
    if (item.kind === 'subtask' && item.taskId === task.id) {
      return { ...current, subtasks: current.subtasks.map(st => (st.id === item.id ? { ...st, completed: item.completed } : st)) };
    }
    return current;
  }, task));
}

export function withPendingBlocks(blocks: ScheduleActivity[], pending = queue): ScheduleActivity[] {
  if (!pending.length) return blocks;
  const status = new Map(pending.flatMap(item => (item.kind === 'block' ? [[item.id, item.status]] : [])));
  return blocks.map(block => (status.has(block.id) ? { ...block, status: status.get(block.id)! } : block));
}

export function withPendingHabits(habits: Habit[], pending = queue): Habit[] {
  if (!pending.length) return habits;
  return habits.map(habit => pending.reduce((current, item) => {
    if (item.kind !== 'habit' || item.id !== habit.id) return current;
    if (current.completions.some(c => c.date.slice(0, 10) === item.date)) return current;
    const completions = [{ id: item.entry, date: item.date, count: 1, habitId: habit.id }, ...current.completions];
    return {
      ...current,
      completions,
      completedToday: current.completedToday || item.date === toDateKey(),
      streak: computeStreak(completions),
      totalCompletions: current.totalCompletions + 1,
    };
  }, habit));
}

/** Re-applies everything waiting to the data on screen. */
export function showPendingCheckIns(queryClient: QueryClient): void {
  queryClient.setQueryData<Task[]>(queryKeys.tasks, old => old && withPendingTasks(old));
  queryClient.setQueryData<ScheduleActivity[]>(queryKeys.schedules, old => old && withPendingBlocks(old));
  queryClient.setQueryData<Habit[]>(queryKeys.habits, old => old && withPendingHabits(old));
}

function send(item: QueuedCheckIn): Promise<unknown> {
  switch (item.kind) {
    case 'habit':
      return apiClient.completeHabit(item.id, { date: item.date });
    case 'task':
      return apiClient.updateTask(item.id, {
        ...mapFrontendTaskUpdateToBackend({ status: item.status }),
        ...(item.status === 'completed' && { completedAt: item.at }),
      });
    case 'block':
      return apiClient.updateSchedule(item.id, mapFrontendActivityUpdateToBackend({ status: item.status }, item.date));
    case 'subtask':
      return apiClient.updateSubtask(item.taskId, item.id, { completed: item.completed });
  }
}

/** Worth trying again later, as opposed to the server saying no. */
const isTemporary = (error: unknown) =>
  !(error instanceof ApiError) || error.status === 401 || error.status === 408 || error.status === 429 || error.status >= 500;

let flushing: Promise<void> | null = null;

async function sendAll(queryClient: QueryClient) {
  let changed = false;
  let delayed = false;

  while (queue.length) {
    const [item] = queue;
    try {
      await send(item);
      delayed ||= Date.now() - item.queuedAt > DELAYED_MS;
      publish(queue.filter(other => other.entry !== item.entry));
      changed = true;
    } catch (error) {
      if (isTemporary(error) && item.attempts + 1 < MAX_ATTEMPTS) {
        // Failing to connect says nothing about the check-in itself.
        if (error instanceof ApiError) publish(queue.map(other => (other.entry === item.entry ? { ...other, attempts: other.attempts + 1 } : other)));
        break;
      }
      // Gone or refused, e.g. deleted on another device: tell the user, and move on.
      publish(queue.filter(other => other.entry !== item.entry));
      changed = true;
      toast.error(`Couldn’t save your check-in for “${item.title}”.`);
    }
  }

  if (!changed || queue.length) return;
  if (delayed) toast.success('Your check-ins are saved.');
  await Promise.all([queryKeys.tasks, queryKeys.schedules, queryKeys.habits, queryKeys.goals, ['analytics']]
    .map(queryKey => queryClient.invalidateQueries({ queryKey })));
}

/** Sends what's waiting, in order. Calls made while it's running share the same run. */
export function flushCheckIns(queryClient: QueryClient): Promise<void> {
  flushing ??= sendAll(queryClient).finally(() => { flushing = null; });
  return flushing;
}
