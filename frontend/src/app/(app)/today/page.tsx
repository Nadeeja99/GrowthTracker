'use client';

import { useRouter } from 'next/navigation';
import { TodayView } from '@/components/Today/TodayView';
import { PageError, combineQueries } from '@/components/ui/PageState';
import { TodaySkeleton } from '@/components/ui/Skeleton';
import { useFocus } from '@/contexts/FocusContext';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { useGoalsWithStats } from '@/hooks/data/useGoals';
import { useScheduleMutations, useSchedules } from '@/hooks/data/useSchedules';
import { useTaskMutations, useTasks } from '@/hooks/data/useTasks';
import { useHabitMutations, useHabits } from '@/hooks/data/useHabits';
import { useReflections, useSaveReflection } from '@/hooks/data/useReflections';
import { toDateKey } from '@/lib/dates';

export default function TodayPage() {
  const router = useRouter();
  const { isMobile } = useDeviceDetection();
  const { focusOn } = useFocus();

  const goals = useGoalsWithStats();
  const schedules = useSchedules();
  const tasks = useTasks();
  const habits = useHabits();
  const reflections = useReflections();
  const scheduleMutations = useScheduleMutations();
  const taskMutations = useTaskMutations();
  const habitMutations = useHabitMutations();
  const saveReflection = useSaveReflection();

  const status = combineQueries(goals, schedules, tasks, habits, reflections);
  if (status.isLoading) return <TodaySkeleton />;
  if (status.error) return <PageError error={status.error} onRetry={status.retry} />;

  const today = toDateKey();

  return (
    <TodayView
      goals={goals.data}
      activities={schedules.data ?? []}
      tasks={tasks.data ?? []}
      habits={habits.data ?? []}
      dailyRating={reflections.data?.find(r => r.date === today) ?? null}
      onActivityStatusChange={(id, status) => scheduleMutations.update.mutate({ id, updates: { status } })}
      onTaskStatusChange={(id, status) => taskMutations.update.mutate({ id, updates: { status } })}
      onCompleteHabit={(id, date) => {
        if (!habits.data?.find(h => h.id === id)?.completedToday) habitMutations.complete.mutate({ id, date });
      }}
      onSaveDailyRating={async rating => { await saveReflection.mutateAsync({ date: today, rating }); }}
      onNavigate={href => router.push(href)}
      onStartFocus={focusOn}
      isMobile={isMobile}
    />
  );
}
