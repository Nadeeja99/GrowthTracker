'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** Server-side summary for a date range (YYYY-MM-DD, interpreted in the user's time zone). */
export function useAnalyticsOverview(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.analyticsOverview(startDate, endDate),
    queryFn: async () => (await apiClient.getAnalyticsOverview(startDate, endDate)).data!.analytics,
  });
}
