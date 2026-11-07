'use client';

import { PlanView } from '@/components/Plan/PlanView';
import { PageError, combineQueries } from '@/components/ui/PageState';
import { PlanSkeleton } from '@/components/ui/Skeleton';
import { useFocus } from '@/contexts/FocusContext';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { useGoalsWithStats } from '@/hooks/data/useGoals';
import { useScheduleMutations, useSchedules } from '@/hooks/data/useSchedules';
import { useCheckIns } from '@/hooks/data/useCheckIns';
import { useTaskMutations, useTasks } from '@/hooks/data/useTasks';

export default function PlanPage() {
  const { isMobile } = useDeviceDetection();
  const { focusOn } = useFocus();
  const goals = useGoalsWithStats();
  const tasks = useTasks();
  const schedules = useSchedules();
  const t = useTaskMutations();
  const s = useScheduleMutations();
  const checkIn = useCheckIns();

  const status = combineQueries(goals, tasks, schedules);
  if (status.isLoading) return <PlanSkeleton />;
  if (status.error) return <PageError error={status.error} onRetry={status.retry} />;

  return (
    <PlanView
      goals={goals.data}
      tasks={tasks.data ?? []}
      activities={schedules.data ?? []}
      onCreateTask={task => t.create.mutate(task)}
      onUpdateTask={(id, updates) => {
        const keys = Object.keys(updates);
        if (keys.length === 1 && updates.status) checkIn.task(id, updates.status);
        else t.update.mutate({ id, updates });
      }}
      onDeleteTask={id => t.remove.mutate(id)}
      onUpdateSubTask={(taskId, subtaskId, updates) => checkIn.subtask(taskId, subtaskId, !!updates.completed)}
      onCreateActivity={activity => s.create.mutate(activity)}
      onCreateActivities={async list => { await s.createMany.mutateAsync(list); }}
      onUpdateActivity={(id, updates) => s.update.mutate({ id, updates })}
      onDeleteActivity={id => s.remove.mutate(id)}
      onActivityStatusChange={checkIn.block}
      onStartFocus={focusOn}
      isMobile={isMobile}
    />
  );
}
