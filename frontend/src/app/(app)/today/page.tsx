'use client';

import { useRouter } from 'next/navigation';
import { TodayView } from '@/components/Today/TodayView';
import { PageError, combineQueries } from '@/components/ui/PageState';
import { TodaySkeleton } from '@/components/ui/Skeleton';
import { useFocus } from '@/contexts/FocusContext';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { useGoalsWithStats } from '@/hooks/data/useGoals';
import { useSchedules } from '@/hooks/data/useSchedules';
import { useTasks } from '@/hooks/data/useTasks';
import { useHabits } from '@/hooks/data/useHabits';
import { useCheckIns } from '@/hooks/data/useCheckIns';
import { useReflections, useSaveReflection } from '@/hooks/data/useReflections';
import { toDateKey } from '@/lib/dates';
import { useCoach } from '@/hooks/data/useCoach';

export default function TodayPage() {
  const router = useRouter();
  const { isMobile } = useDeviceDetection();
  const { focusOn } = useFocus();

  const goals = useGoalsWithStats();
  const schedules = useSchedules();
  const tasks = useTasks();
  const habits = useHabits();
  const reflections = useReflections();
  const checkIn = useCheckIns();
  const saveReflection = useSaveReflection();

  const status = combineQueries(goals, schedules, tasks, habits, reflections);
  // Wait for the AI status too (fetched in parallel), so its card doesn't
  // appear late and push the page down. Its failure never blocks the page.
  const coach = useCoach();
  if (status.isLoading || coach.isLoading) return <TodaySkeleton />;
  if (status.error) return <PageError error={status.error} onRetry={status.retry} />;

  const today = toDateKey();

  return (
    <TodayView
      goals={goals.data}
      activities={schedules.data ?? []}
      tasks={tasks.data ?? []}
      habits={habits.data ?? []}
      dailyRating={reflections.data?.find(r => r.date === today) ?? null}
      onActivityStatusChange={checkIn.block}
      onTaskStatusChange={checkIn.task}
      onCompleteHabit={(id, date) => {
        if (!habits.data?.find(h => h.id === id)?.completedToday) checkIn.habit(id, date);
      }}
      onSaveDailyRating={async rating => { await saveReflection.mutateAsync({ date: today, rating }); }}
      onNavigate={href => router.push(href)}
      onStartFocus={focusOn}
      isMobile={isMobile}
    />
  );
}
