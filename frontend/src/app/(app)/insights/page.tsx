'use client';

import { useState } from 'react';
import { Analytics, TimeRange, getRangeStart } from '@/components/Analytics/Analytics';
import { PageError, combineQueries } from '@/components/ui/PageState';
import { InsightsSkeleton } from '@/components/ui/Skeleton';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { useGoalsWithStats } from '@/hooks/data/useGoals';
import { useSchedules } from '@/hooks/data/useSchedules';
import { useTasks } from '@/hooks/data/useTasks';
import { useReflections } from '@/hooks/data/useReflections';
import { useAnalyticsOverview } from '@/hooks/data/useAnalyticsOverview';
import { toDateKey } from '@/lib/dates';
import { useCoach } from '@/hooks/data/useCoach';

export default function InsightsPage() {
  const { isMobile } = useDeviceDetection();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const goals = useGoalsWithStats();
  const schedules = useSchedules();
  const tasks = useTasks();
  const reflections = useReflections();
  // Totals come from the server for the same range the charts show.
  const summary = useAnalyticsOverview(toDateKey(getRangeStart(timeRange)), toDateKey());

  const status = combineQueries(goals, schedules, tasks, reflections);
  // Wait for the AI status too (fetched in parallel), so its card doesn't
  // appear late and push the page down. Its failure never blocks the page.
  const coach = useCoach();
  if (status.isLoading || coach.isLoading) return <InsightsSkeleton />;
  if (status.error) return <PageError error={status.error} onRetry={status.retry} />;

  return (
    <Analytics
      goals={goals.data}
      activities={schedules.data ?? []}
      tasks={tasks.data ?? []}
      dailyRatings={reflections.data ?? []}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
      summary={summary.data}
      isMobile={isMobile}
    />
  );
}
