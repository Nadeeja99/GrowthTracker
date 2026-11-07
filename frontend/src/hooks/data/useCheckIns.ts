'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { checkInStore, CheckIn, enqueueCheckIn, flushCheckIns, showPendingCheckIns } from '@/lib/checkIns';
import { queryKeys } from '@/lib/queryKeys';
import type { Habit, ScheduleActivity, Task } from '@/types';

// Connections can come back without the browser saying so.
const RETRY_INTERVAL_MS = 30_000;

/** The check-ins available to the UI. Each shows at once and syncs on its own. */
export function useCheckIns() {
  const queryClient = useQueryClient();

  return useMemo(() => {
    const record = (checkIn: CheckIn, title: string) => {
      enqueueCheckIn(checkIn, title);
      showPendingCheckIns(queryClient);
      void flushCheckIns(queryClient);
    };
    const task = (id: string) => queryClient.getQueryData<Task[]>(queryKeys.tasks)?.find(t => t.id === id);

    return {
      habit(id: string, date: string) {
        const name = queryClient.getQueryData<Habit[]>(queryKeys.habits)?.find(h => h.id === id)?.name;
        record({ kind: 'habit', id, date }, name ?? 'a habit');
      },
      task(id: string, status: Task['status']) {
        record({ kind: 'task', id, status, at: new Date().toISOString() }, task(id)?.title ?? 'a task');
      },
      block(id: string, status: ScheduleActivity['status']) {
        const block = queryClient.getQueryData<ScheduleActivity[]>(queryKeys.schedules)?.find(a => a.id === id);
        record({ kind: 'block', id, status, date: block?.date }, block?.title ?? 'a time block');
      },
      subtask(taskId: string, id: string, completed: boolean) {
        const parent = task(taskId);
        record({ kind: 'subtask', id, taskId, completed }, parent?.subtasks.find(st => st.id === id)?.title ?? parent?.title ?? 'a subtask');
      },
    };
  }, [queryClient]);
}

export const usePendingCheckIns = () =>
  useSyncExternalStore(checkInStore.subscribe, checkInStore.getSnapshot, checkInStore.getServerSnapshot);

export const useIsOnline = () =>
  useSyncExternalStore(onlineManager.subscribe.bind(onlineManager), () => onlineManager.isOnline(), () => true);

/** Sends waiting check-ins when the app opens, comes back, or reconnects. */
export function useCheckInSync() {
  const queryClient = useQueryClient();
  const pending = usePendingCheckIns().length;
  const isOnline = useIsOnline();
  const sync = useCallback(() => {
    if (onlineManager.isOnline()) void flushCheckIns(queryClient);
  }, [queryClient]);

  useEffect(() => {
    if (isOnline) sync();
  }, [isOnline, sync]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [sync]);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(sync, RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pending, sync]);
}
