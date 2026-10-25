'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, CoachStatus, CoachSuggestion, CoachTurn } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useCoach(enabled = true) {
  return useQuery({
    queryKey: queryKeys.coach,
    queryFn: async () => (await apiClient.getCoach()).data!,
    enabled,
  });
}

// What to refresh once a suggestion has created a record.
const AFFECTED: Record<CoachSuggestion['kind'], readonly string[]> = {
  task: queryKeys.tasks,
  time_block: queryKeys.schedules,
  habit: queryKeys.habits,
};

export function useCoachMutations() {
  const queryClient = useQueryClient();
  const patch = (update: (status: CoachStatus) => CoachStatus) =>
    queryClient.setQueryData<CoachStatus>(queryKeys.coach, old => old && update(old));

  const setEnabled = useMutation({
    meta: { action: 'change the AI Coach setting' },
    mutationFn: (enabled: boolean) => apiClient.setCoachEnabled(enabled),
    onSuccess: (_res, enabled) => patch(s => ({ ...s, enabled })),
  });

  const clear = useMutation({
    meta: { action: 'clear the conversation' },
    mutationFn: () => apiClient.clearCoachMessages(),
    onSuccess: () => patch(s => ({ ...s, messages: [] })),
  });

  const apply = useMutation({
    meta: { action: 'add the suggestion' },
    mutationFn: ({ messageId, suggestionId }: { messageId: string; suggestionId: string }) =>
      apiClient.applyCoachSuggestion(messageId, suggestionId),
    onSuccess: (res, { messageId }) => {
      const applied = res.data!.suggestion;
      patch(s => ({
        ...s,
        messages: s.messages.map(m => m.id !== messageId ? m : {
          ...m,
          suggestions: m.suggestions.map(x => (x.id === applied.id ? applied : x)),
        }),
      }));
      queryClient.invalidateQueries({ queryKey: AFFECTED[applied.kind] });
    },
    // e.g. already added in another tab: show the server's state.
    onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.coach }),
  });

  /** Adds a finished turn from the streaming endpoint to the cache. */
  const appendTurn = (turn: CoachTurn) =>
    patch(s => ({ ...s, usage: turn.usage, messages: [...s.messages, turn.userMessage, turn.message] }));

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.coach });

  return { setEnabled, clear, apply, appendTurn, refresh };
}
