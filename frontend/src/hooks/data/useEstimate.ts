'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient, EstimateParams } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** `value`, once it has stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/**
 * How long a task like this usually takes this person, from their finished,
 * timed tasks. `params` is null while there's no valid estimate to check.
 * Waits for typing to pause, keeps the last answer on screen while the next
 * loads, and stays quiet on errors: it's a hint, not something to fix.
 */
export function useEstimate(params: EstimateParams | null) {
  // Compare by value: a new object with the same fields mustn't restart the timer.
  const key = params && JSON.stringify(params);
  const settledKey = useDebouncedValue(key, 400);
  const settled: EstimateParams | null = settledKey ? JSON.parse(settledKey) : null;
  const query = useQuery({
    queryKey: queryKeys.estimate(settled),
    queryFn: async ({ signal }) => (await apiClient.getEstimate(settled!, signal)).data!,
    enabled: settled !== null && settledKey === key,
    staleTime: 60_000,
    retry: false,
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });
  return {
    data: key ? query.data : undefined,
    /** False while the shown answer is for what was typed before. */
    isCurrent: settledKey === key && !query.isPlaceholderData,
  };
}
