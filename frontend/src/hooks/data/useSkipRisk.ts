'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient, BlockRisk } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

const NONE = new Map<string, BlockRisk>();

/**
 * Skip risk for upcoming blocks, by block id. Empty until the person has
 * enough blocks with a known result. A hint, so failures stay quiet.
 */
export function useSkipRisks(): Map<string, BlockRisk> {
  const { data } = useQuery({
    queryKey: queryKeys.skipRisk,
    queryFn: async ({ signal }) => new Map((await apiClient.getSkipRisks(signal)).data!.risks.map(r => [r.id, r])),
    staleTime: 5 * 60_000,
    retry: false,
    meta: { silent: true },
  });
  return data ?? NONE;
}
