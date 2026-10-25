'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Goal, GoalInput } from '@/types';
import { apiClient, BackendGoal } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { applyGoalStats, mapBackendGoalToFrontend, mapGoalInputToBackend, mapGoalUpdateToBackend } from '@/lib/goalMapper';
import { useSchedules } from './useSchedules';
import { useFocusSessions } from './useFocusSessions';

export function useGoals() {
  return useQuery({
    queryKey: queryKeys.goals,
    queryFn: async () => (await apiClient.getGoals()).data!.goals.map(mapBackendGoalToFrontend),
  });
}

/** Goals with weekly hours and streaks derived from schedule blocks and focus sessions. */
export function useGoalsWithStats() {
  const goals = useGoals();
  const schedules = useSchedules();
  const focus = useFocusSessions();
  const data = useMemo(
    () => (goals.data ?? []).map(goal => applyGoalStats(goal, schedules.data ?? [], focus.data ?? [])),
    [goals.data, schedules.data, focus.data]
  );
  return {
    data,
    isLoading: goals.isLoading || schedules.isLoading || focus.isLoading,
    // Only blocking when there's nothing to show (see combineQueries).
    error: goals.data ? null : goals.error,
    refetch: goals.refetch,
  };
}

export function useGoalMutations() {
  const queryClient = useQueryClient();

  const putGoal = (backendGoal: BackendGoal) => {
    const goal = mapBackendGoalToFrontend(backendGoal);
    queryClient.setQueryData<Goal[]>(queryKeys.goals, old =>
      old?.some(g => g.id === goal.id) ? old.map(g => (g.id === goal.id ? goal : g)) : [...(old ?? []), goal]
    );
  };

  const create = useMutation({
    meta: { action: 'create the goal' },
    mutationFn: (input: GoalInput) => apiClient.createGoal(mapGoalInputToBackend(input)),
    onSuccess: res => putGoal(res.data!.goal),
  });

  const update = useMutation({
    meta: { action: 'save the goal' },
    mutationFn: ({ id, updates }: { id: string; updates: Partial<GoalInput> }) =>
      apiClient.updateGoal(id, mapGoalUpdateToBackend(updates)),
    onSuccess: res => putGoal(res.data!.goal),
  });

  const remove = useMutation({
    meta: { action: 'delete the goal' },
    mutationFn: (id: string) => apiClient.deleteGoal(id),
    onSuccess: (_res, id) => {
      queryClient.setQueryData<Goal[]>(queryKeys.goals, old => old?.filter(g => g.id !== id));
      // Linked tasks and blocks are kept but unlinked server-side; refetch them.
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules });
    },
  });

  // Milestone responses carry the parent goal with its recalculated progress.
  const addMilestone = useMutation({
    meta: { silent: true },
    mutationFn: ({ goalId, title, targetDate }: { goalId: string; title: string; targetDate?: string }) =>
      apiClient.createMilestone(goalId, { title, targetDate: targetDate ? `${targetDate}T00:00:00.000Z` : undefined }),
    onSuccess: res => putGoal(res.data!.goal),
  });

  const toggleMilestone = useMutation({
    meta: { silent: true },
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => apiClient.updateMilestone(id, { completed }),
    onSuccess: res => putGoal(res.data!.goal),
  });

  const deleteMilestone = useMutation({
    meta: { silent: true },
    mutationFn: (id: string) => apiClient.deleteMilestone(id),
    onSuccess: res => putGoal(res.data!.goal),
  });

  return { create, update, remove, addMilestone, toggleMilestone, deleteMilestone };
}
