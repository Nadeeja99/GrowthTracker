'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DailyRating } from '@/types';
import { apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { mapBackendReflectionToRating, mapRatingToReflectionPayload } from '@/lib/reflectionMapper';

const LEGACY_RATINGS_KEY = 'dev-tracker-ratings';

// Earlier versions kept daily reviews only in localStorage. Upload them once;
// the server never overwrites an existing day, and the local copy is removed
// only after the upload succeeds.
async function importLegacyRatings(): Promise<void> {
  let legacy: DailyRating[];
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_RATINGS_KEY) ?? '[]');
  } catch {
    return;
  }
  if (!Array.isArray(legacy) || legacy.length === 0) return;
  try {
    const valid = legacy.filter(r => typeof r?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
    await apiClient.importReflections(valid.map(r => ({ date: r.date, ...mapRatingToReflectionPayload(r) })));
    localStorage.removeItem(LEGACY_RATINGS_KEY);
  } catch (error) {
    console.error('Importing locally stored reviews failed; will retry next load:', error);
  }
}

export function useReflections() {
  return useQuery({
    queryKey: queryKeys.reflections,
    queryFn: async () => {
      await importLegacyRatings();
      return (await apiClient.getReflections()).data!.reflections.map(mapBackendReflectionToRating);
    },
  });
}

export function useSaveReflection() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { silent: true }, // shown inline by the calling UI
    mutationFn: ({ date, rating }: { date: string; rating: Omit<DailyRating, 'date'> }) =>
      apiClient.saveReflection(date, mapRatingToReflectionPayload(rating)),
    onSuccess: res => {
      const saved = mapBackendReflectionToRating(res.data!.reflection);
      queryClient.setQueryData<DailyRating[]>(queryKeys.reflections, old => [
        ...(old ?? []).filter(r => r.date !== saved.date),
        saved,
      ]);
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
