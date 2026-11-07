import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { ApiError, apiClient } from './api';
import {
  checkInStore, discardCheckIns, enqueueCheckIn, flushCheckIns, openCheckIns, showPendingCheckIns,
  withPendingBlocks, withPendingHabits, withPendingTasks,
} from './checkIns';
import { queryKeys } from './queryKeys';
import { toDateKey } from './dates';
import { dismiss, toastStore } from './toast';
import type { Habit, ScheduleActivity, Task } from '@/types';

const waiting = () => checkInStore.getSnapshot();
const task = (id: string): Task => ({ id, title: id, status: 'todo', priority: 'medium', subtasks: [{ id: 's1', title: 'Sub', completed: false }], tags: [], createdAt: '2026-01-01' });
const habit = (id: string): Habit => ({ id, name: id, frequency: 'daily', targetCount: 1, createdAt: '2026-01-01', completions: [], streak: 0, completedToday: false, totalCompletions: 0 });
const block = (id: string): ScheduleActivity => ({ id, title: id, startTime: '09:00', endTime: '10:00', date: '2026-11-08', status: 'pending' });
const taskCheckIn = (id: string, status: Task['status'] = 'completed') => ({ kind: 'task' as const, id, status, at: '2026-11-08T10:00:00.000Z' });

const ok = { success: true };
let queryClient: QueryClient;

beforeEach(() => {
  localStorage.clear();
  queryClient = new QueryClient();
  openCheckIns('user-1');
  discardCheckIns();
});
afterEach(() => vi.restoreAllMocks());

describe('the queue', () => {
  it('survives the app closing, for the same user only', () => {
    enqueueCheckIn(taskCheckIn('t1'), 'Task one');
    openCheckIns(null);
    expect(waiting()).toEqual([]);
    openCheckIns('user-2');
    expect(waiting()).toEqual([]);
    openCheckIns('user-1');
    expect(waiting().map(item => item.title)).toEqual(['Task one']);
  });

  it('keeps only the newest choice for the same item', () => {
    enqueueCheckIn(taskCheckIn('t1', 'completed'), 'Task');
    enqueueCheckIn(taskCheckIn('t1', 'todo'), 'Task');
    expect(waiting()).toHaveLength(1);
    expect(waiting()[0]).toMatchObject({ status: 'todo' });
  });

  it('treats the same habit on different days as separate', () => {
    enqueueCheckIn({ kind: 'habit', id: 'h1', date: '2026-11-07' }, 'Read');
    enqueueCheckIn({ kind: 'habit', id: 'h1', date: '2026-11-08' }, 'Read');
    expect(waiting()).toHaveLength(2);
  });

  it('removes what’s stored when discarded', () => {
    enqueueCheckIn(taskCheckIn('t1'), 'Task');
    discardCheckIns();
    expect(localStorage.getItem('growthtracker-checkins:user-1')).toBeNull();
  });
});

describe('showing waiting check-ins', () => {
  it('marks tasks done, with the time they were done', () => {
    enqueueCheckIn(taskCheckIn('t1'), 'Task');
    const [done, other] = withPendingTasks([task('t1'), task('t2')]);
    expect(done).toMatchObject({ status: 'completed', completedAt: '2026-11-08T10:00:00.000Z' });
    expect(other.status).toBe('todo');
  });

  it('ticks subtasks', () => {
    enqueueCheckIn({ kind: 'subtask', id: 's1', taskId: 't1', completed: true }, 'Sub');
    expect(withPendingTasks([task('t1')])[0].subtasks[0].completed).toBe(true);
  });

  it('updates blocks', () => {
    enqueueCheckIn({ kind: 'block', id: 'b1', status: 'skipped' }, 'Block');
    expect(withPendingBlocks([block('b1')])[0].status).toBe('skipped');
  });

  it('completes today’s habit and counts the streak', () => {
    enqueueCheckIn({ kind: 'habit', id: 'h1', date: toDateKey() }, 'Read');
    expect(withPendingHabits([habit('h1')])[0]).toMatchObject({ completedToday: true, streak: 1, totalCompletions: 1 });
  });

  it('doesn’t count a habit twice once the server has it', () => {
    const date = toDateKey();
    enqueueCheckIn({ kind: 'habit', id: 'h1', date }, 'Read');
    const fromServer = { ...habit('h1'), completions: [{ id: 'c1', date: `${date}T00:00:00.000Z`, count: 1, habitId: 'h1' }], totalCompletions: 1 };
    expect(withPendingHabits([fromServer])[0].totalCompletions).toBe(1);
  });

  it('updates what’s on screen', () => {
    queryClient.setQueryData(queryKeys.tasks, [task('t1')]);
    enqueueCheckIn(taskCheckIn('t1'), 'Task');
    showPendingCheckIns(queryClient);
    expect(queryClient.getQueryData<Task[]>(queryKeys.tasks)?.[0].status).toBe('completed');
  });
});

describe('syncing', () => {
  it('sends each kind to the right place, in order, then refreshes', async () => {
    const calls: string[] = [];
    vi.spyOn(apiClient, 'completeHabit').mockImplementation(async id => { calls.push(`habit ${id}`); return ok; });
    const updateTask = vi.spyOn(apiClient, 'updateTask').mockImplementation(async id => { calls.push(`task ${id}`); return ok; });
    vi.spyOn(apiClient, 'updateSchedule').mockImplementation(async id => { calls.push(`block ${id}`); return ok; });
    vi.spyOn(apiClient, 'updateSubtask').mockImplementation(async (_t, id) => { calls.push(`subtask ${id}`); return ok; });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    enqueueCheckIn({ kind: 'habit', id: 'h1', date: '2026-11-08' }, 'Read');
    enqueueCheckIn(taskCheckIn('t1'), 'Task');
    enqueueCheckIn({ kind: 'block', id: 'b1', status: 'completed', date: '2026-11-08' }, 'Block');
    enqueueCheckIn({ kind: 'subtask', id: 's1', taskId: 't1', completed: true }, 'Sub');
    await flushCheckIns(queryClient);

    expect(calls).toEqual(['habit h1', 'task t1', 'block b1', 'subtask s1']);
    expect(updateTask).toHaveBeenCalledWith('t1', { status: 'COMPLETED', completedAt: '2026-11-08T10:00:00.000Z' });
    expect(waiting()).toEqual([]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.habits });
  });

  it('keeps everything when the connection is down, and carries on later', async () => {
    const send = vi.spyOn(apiClient, 'updateTask').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1000).mockReturnValueOnce(1000).mockReturnValueOnce(1000);
    enqueueCheckIn(taskCheckIn('t1'), 'One');
    enqueueCheckIn(taskCheckIn('t2'), 'Two');

    await flushCheckIns(queryClient);
    expect(waiting()).toHaveLength(2);
    expect(send).toHaveBeenCalledTimes(1);

    send.mockResolvedValue(ok);
    await flushCheckIns(queryClient);
    expect(waiting()).toEqual([]);
    expect(toastStore.getSnapshot().some(t => t.message === 'Your check-ins are saved.')).toBe(true);
  });

  it('says nothing after an ordinary quick save', async () => {
    vi.spyOn(apiClient, 'updateTask').mockResolvedValue(ok);
    toastStore.getSnapshot().forEach(t => dismiss(t.id));
    enqueueCheckIn(taskCheckIn('t1'), 'Task');
    await flushCheckIns(queryClient);
    expect(toastStore.getSnapshot()).toEqual([]);
  });

  it('waits while the session needs renewing', async () => {
    vi.spyOn(apiClient, 'updateTask').mockRejectedValue(new ApiError('Session expired', 401));
    enqueueCheckIn(taskCheckIn('t1'), 'Task');
    await flushCheckIns(queryClient);
    expect(waiting()).toHaveLength(1);
  });

  it('drops something the server refuses, says so, and moves on', async () => {
    vi.spyOn(apiClient, 'updateTask')
      .mockRejectedValueOnce(new ApiError('Task not found', 404))
      .mockResolvedValue(ok);
    enqueueCheckIn(taskCheckIn('deleted'), 'Deleted elsewhere');
    enqueueCheckIn(taskCheckIn('t2'), 'Still here');

    await flushCheckIns(queryClient);

    expect(waiting()).toEqual([]);
    expect(toastStore.getSnapshot().some(t => t.message.includes('Deleted elsewhere'))).toBe(true);
  });

  it('gives up on something the server keeps failing on', async () => {
    vi.spyOn(apiClient, 'updateTask').mockRejectedValue(new ApiError('Server error', 500));
    enqueueCheckIn(taskCheckIn('t1'), 'Stuck');
    for (let i = 0; i < 8; i++) await flushCheckIns(queryClient);
    expect(waiting()).toEqual([]);
  });

  it('keeps a newer choice made while the older one was being sent', async () => {
    let finish: (value: typeof ok) => void = () => undefined;
    const send = vi.spyOn(apiClient, 'updateTask').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    enqueueCheckIn(taskCheckIn('t1', 'completed'), 'Task');
    const first = flushCheckIns(queryClient);

    enqueueCheckIn(taskCheckIn('t1', 'todo'), 'Task');
    send.mockResolvedValue(ok);
    finish(ok);
    await first;

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][1]).toEqual({ status: 'PENDING' });
    expect(waiting()).toEqual([]);
  });

  it('shares one run between callers', async () => {
    const send = vi.spyOn(apiClient, 'updateTask').mockResolvedValue(ok);
    enqueueCheckIn(taskCheckIn('t1'), 'Task');
    await Promise.all([flushCheckIns(queryClient), flushCheckIns(queryClient)]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
