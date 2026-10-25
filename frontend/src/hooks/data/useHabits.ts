'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Habit } from '@/types';
import { apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { mapBackendHabitToFrontend } from '@/lib/habitMapper';

type HabitInput = { name: string; description?: string; frequency: string; targetCount: number };

export function useHabits() {
  return useQuery({
    queryKey: queryKeys.habits,
    // One request: the list includes each habit's recent completions.
    queryFn: async () => (await apiClient.getHabits()).data!.habits.map(mapBackendHabitToFrontend),
  });
}

export function useHabitMutations() {
  const queryClient = useQueryClient();
  const refetch = () => queryClient.invalidateQueries({ queryKey: queryKeys.habits });

  const create = useMutation({
    meta: { action: 'create the habit' },
    mutationFn: (data: HabitInput) => apiClient.createHabit({ ...data, frequency: data.frequency.toUpperCase() }),
    onSuccess: refetch,
  });

  const update = useMutation({
    meta: { action: 'save the habit' },
    mutationFn: ({ id, data }: { id: string; data: Partial<HabitInput> }) =>
      apiClient.updateHabit(id, { ...data, ...(data.frequency ? { frequency: data.frequency.toUpperCase() } : {}) }),
    onSuccess: refetch,
  });

  const remove = useMutation({
    meta: { action: 'delete the habit' },
    mutationFn: (id: string) => apiClient.deleteHabit(id),
    onSuccess: (_res, id) => queryClient.setQueryData<Habit[]>(queryKeys.habits, old => old?.filter(h => h.id !== id)),
  });

  const complete = useMutation({
    meta: { action: 'complete the habit' },
    mutationFn: ({ id, date }: { id: string; date: string }) => apiClient.completeHabit(id, { date }),
    onSuccess: refetch, // streaks and "done today" are derived from completions
  });

  return { create, update, remove, complete };
}
