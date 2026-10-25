'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FocusSession } from '@/types';
import { apiClient, FocusSessionPayload } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { mapBackendFocusSession } from '@/lib/focusMapper';

export function useFocusSessions() {
  return useQuery({
    queryKey: queryKeys.focusSessions,
    // Defaults to the last 30 days: enough for weekly hours and streaks.
    queryFn: async () => (await apiClient.getFocusSessions()).data!.sessions.map(mapBackendFocusSession),
  });
}

export function useRecordFocusSession() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { silent: true }, // shown inline by the calling UI
    mutationFn: (payload: FocusSessionPayload) => apiClient.createFocusSession(payload),
    onSuccess: res => {
      const session = mapBackendFocusSession(res.data!.session);
      queryClient.setQueryData<FocusSession[]>(queryKeys.focusSessions, old => [...(old ?? []), session]);
      // The linked task's logged time changed server-side.
      if (session.taskId) queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
