'use client';

import { HabitTracker } from '@/components/Habits/HabitTracker';
import { PageError, combineQueries } from '@/components/ui/PageState';
import { HabitsSkeleton } from '@/components/ui/Skeleton';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { useHabitMutations, useHabits } from '@/hooks/data/useHabits';

export default function HabitsPage() {
  const { isMobile } = useDeviceDetection();
  const habits = useHabits();
  const m = useHabitMutations();

  const status = combineQueries(habits);
  if (status.isLoading) return <HabitsSkeleton />;
  if (status.error) return <PageError error={status.error} onRetry={status.retry} />;

  return (
    <HabitTracker
      habits={habits.data ?? []}
      onCreateHabit={async data => { await m.create.mutateAsync(data); }}
      onUpdateHabit={async (id, data) => { await m.update.mutateAsync({ id, data }); }}
      onDeleteHabit={async id => { await m.remove.mutateAsync(id); }}
      onCompleteHabit={async (id, date) => {
        if (habits.data?.find(h => h.id === id)?.completedToday) return;
        await m.complete.mutateAsync({ id, date });
      }}
      isMobile={isMobile}
    />
  );
}
