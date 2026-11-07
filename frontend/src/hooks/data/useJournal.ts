'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, JournalAnswer } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { describeError } from '@/lib/toast';

export function useJournalSearch() {
  return useMutation({
    meta: { silent: true }, // shown inline
    mutationFn: async (query: string) => (await apiClient.searchJournal(query)).data!.notes,
  });
}

type AnswerState =
  | { status: 'idle' }
  /** `text` grows as the answer streams in; empty until it starts. */
  | { status: 'asking'; text: string }
  | { status: 'done'; result: JournalAnswer }
  | { status: 'error'; message: string };

/** One question at a time. Answers aren't kept: they live only in this state. */
export function useJournalAnswer() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AnswerState>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ status: 'idle' });
  }, []);

  useEffect(() => () => controller.current?.abort(), []);

  const ask = useCallback(async (question: string) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState({ status: 'asking', text: '' });

    let text = '';
    try {
      const result = await apiClient.askJournal(question, {
        signal: current.signal,
        onDelta: delta => {
          text += delta;
          if (controller.current === current) setState({ status: 'asking', text });
        },
      });
      if (controller.current === current) setState({ status: 'done', result });
    } catch (error) {
      // Stopped, or replaced by a newer question: nothing to report.
      if (controller.current === current) setState({ status: 'error', message: describeError(error) });
    } finally {
      // Every answer spends from the daily budget the coach shows.
      queryClient.invalidateQueries({ queryKey: queryKeys.coach });
    }
  }, [queryClient]);

  return { state, ask, reset };
}
