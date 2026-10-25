'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScheduleActivity } from '@/types';
import { apiClient, BackendSchedule } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  mapBackendScheduleToFrontend,
  mapFrontendActivityToBackend,
  mapFrontendActivityUpdateToBackend,
} from '@/lib/scheduleMapper';

export type ActivityInput = Omit<ScheduleActivity, 'id' | 'taskTitle'>;

export function useSchedules() {
  return useQuery({
    queryKey: queryKeys.schedules,
    queryFn: async () => (await apiClient.getSchedules()).data!.schedules.map(mapBackendScheduleToFrontend),
  });
}

export function useScheduleMutations() {
  const queryClient = useQueryClient();

  const putActivity = (backendSchedule: BackendSchedule) => {
    const activity = mapBackendScheduleToFrontend(backendSchedule);
    queryClient.setQueryData<ScheduleActivity[]>(queryKeys.schedules, old =>
      old?.some(a => a.id === activity.id)
        ? old.map(a => (a.id === activity.id ? activity : a))
        : [...(old ?? []), activity]
    );
  };

  const create = useMutation({
    meta: { action: 'add the time block' },
    mutationFn: (activity: ActivityInput) => apiClient.createSchedule(mapFrontendActivityToBackend(activity)),
    onSuccess: res => putActivity(res.data!.schedule),
  });

  // Recurring schedules: one request for all blocks, then refetch.
  const createMany = useMutation({
    meta: { action: 'create the recurring blocks' },
    mutationFn: (activities: ActivityInput[]) => apiClient.createSchedulesBulk(activities.map(mapFrontendActivityToBackend)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.schedules }),
  });

  const update = useMutation({
    meta: { action: 'save the time block' },
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ScheduleActivity> }) => {
      const current = queryClient.getQueryData<ScheduleActivity[]>(queryKeys.schedules)?.find(a => a.id === id);
      return apiClient.updateSchedule(id, mapFrontendActivityUpdateToBackend(updates, current?.date));
    },
    onSuccess: res => putActivity(res.data!.schedule),
  });

  const remove = useMutation({
    meta: { action: 'delete the time block' },
    mutationFn: (id: string) => apiClient.deleteSchedule(id),
    onSuccess: (_res, id) => {
      queryClient.setQueryData<ScheduleActivity[]>(queryKeys.schedules, old => old?.filter(a => a.id !== id));
    },
  });

  return { create, createMany, update, remove };
}
