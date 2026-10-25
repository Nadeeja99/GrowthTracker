'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useCoach } from './useCoach';

/** Whether AI features can be offered: the server has a provider, and the user opted in. */
export function useAiStatus() {
  const status = useCoach().data;
  return { configured: !!status?.configured, enabled: !!status?.enabled, remaining: status?.usage.remaining };
}

// Every AI call spends from the daily budget the coach shows.
function useRefreshUsage() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.coach });
}

export function useWeeklyReview(weekStart: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.weeklyReview(weekStart),
    queryFn: async () => (await apiClient.getWeeklyReview(weekStart)).data!.review,
    enabled,
  });
}

export function useGenerateWeeklyReview() {
  const queryClient = useQueryClient();
  const refreshUsage = useRefreshUsage();
  return useMutation({
    meta: { silent: true }, // shown inline
    mutationFn: (weekStart: string) => apiClient.generateWeeklyReview(weekStart),
    onSuccess: (res, weekStart) => queryClient.setQueryData(queryKeys.weeklyReview(weekStart), res.data!.review),
    onSettled: refreshUsage,
  });
}

export function usePlanWeek() {
  const refreshUsage = useRefreshUsage();
  return useMutation({
    meta: { silent: true },
    mutationFn: ({ weekStart, window }: { weekStart: string; window: { start: string; end: string } }) =>
      apiClient.planWeek(weekStart, window),
    onSettled: refreshUsage,
  });
}

export function useSuggestMilestones() {
  const refreshUsage = useRefreshUsage();
  return useMutation({
    meta: { silent: true },
    mutationFn: (goalId: string) => apiClient.suggestMilestones(goalId),
    onSettled: refreshUsage,
  });
}
