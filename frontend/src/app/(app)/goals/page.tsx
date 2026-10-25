'use client';

import { GoalManager } from '@/components/Goals/GoalManager';
import { PageError, combineQueries } from '@/components/ui/PageState';
import { GoalsSkeleton } from '@/components/ui/Skeleton';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { useGoalMutations, useGoalsWithStats } from '@/hooks/data/useGoals';

export default function GoalsPage() {
  const { isMobile } = useDeviceDetection();
  const goals = useGoalsWithStats();
  const m = useGoalMutations();

  const status = combineQueries(goals);
  if (status.isLoading) return <GoalsSkeleton />;
  if (status.error) return <PageError error={status.error} onRetry={status.retry} />;

  return (
    <GoalManager
      goals={goals.data}
      onCreateGoal={async input => { await m.create.mutateAsync(input); }}
      onUpdateGoal={async (id, updates) => { await m.update.mutateAsync({ id, updates }); }}
      onDeleteGoal={async id => { await m.remove.mutateAsync(id); }}
      onAddMilestone={async (goalId, title, targetDate) => { await m.addMilestone.mutateAsync({ goalId, title, targetDate }); }}
      onToggleMilestone={async (id, completed) => { await m.toggleMilestone.mutateAsync({ id, completed }); }}
      onDeleteMilestone={async id => { await m.deleteMilestone.mutateAsync(id); }}
      isMobile={isMobile}
    />
  );
}
