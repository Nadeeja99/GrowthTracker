'use client';

import React, { useState } from 'react';
import { CalendarDays, Plus, RotateCcw } from 'lucide-react';
import { Goal, ScheduleActivity, SubTask, Task } from '@/types';
import { cn } from '@/lib/utils';
import { toDateKey } from '@/lib/dates';
import { FocusTarget } from '@/contexts/FocusContext';
import { ScheduleCalendar } from '@/components/Schedule/ScheduleCalendar';
import { DailySchedule } from '@/components/Schedule/DailySchedule';
import { ActivityForm } from '@/components/Schedule/ActivityForm';
import { RecurringScheduleForm } from '@/components/Schedule/RecurringScheduleForm';
import { TaskManager } from '@/components/Tasks/TaskManager';

type ActivityInput = Omit<ScheduleActivity, 'id' | 'taskTitle'>;

interface PlanViewProps {
  goals: Goal[];
  tasks: Task[];
  activities: ScheduleActivity[];
  onCreateTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateSubTask: (taskId: string, subTaskId: string, updates: Partial<SubTask>) => void;
  onCreateActivity: (activity: ActivityInput) => void;
  onCreateActivities: (activities: ActivityInput[]) => Promise<void>;
  onUpdateActivity: (activityId: string, updates: Partial<ScheduleActivity>) => void;
  onDeleteActivity: (activityId: string) => void;
  onActivityStatusChange: (activityId: string, status: ScheduleActivity['status']) => void;
  onStartFocus: (target: FocusTarget) => void;
  isMobile: boolean;
}

type Modal =
  | { type: 'activity'; activity?: ScheduleActivity; initialValues?: Partial<ActivityInput> }
  | { type: 'recurring' }
  | null;

const Segmented = <T extends string>({ value, options, onChange, className }: {
  value: T; options: Array<{ id: T; label: string }>; onChange: (id: T) => void; className?: string;
}) => (
  <div className={cn('flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1', className)} role="tablist">
    {options.map(option => (
      <button
        key={option.id}
        role="tab"
        aria-selected={value === option.id}
        onClick={() => onChange(option.id)}
        className={cn(
          'flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          value === option.id
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

// Plan = what to do (tasks) + when to do it (time blocks on the calendar).
export function PlanView(props: PlanViewProps) {
  const { goals, tasks, activities, onStartFocus, isMobile } = props;
  const [selectedDate, setSelectedDate] = useState(toDateKey());
  const [timeline, setTimeline] = useState<'week' | 'day'>('week');
  const [pane, setPane] = useState<'timeline' | 'tasks'>('timeline');
  const [modal, setModal] = useState<Modal>(null);
  const [recurringBusy, setRecurringBusy] = useState(false);

  const close = () => setModal(null);
  const editActivity = (activity: ScheduleActivity) => setModal({ type: 'activity', activity });

  const scheduleTask = (task: Task) => {
    setModal({ type: 'activity', initialValues: { title: task.title, taskId: task.id, goalId: task.goalId, date: selectedDate } });
  };

  const submitActivity = (data: ActivityInput) => {
    if (modal?.type === 'activity' && modal.activity) props.onUpdateActivity(modal.activity.id, data);
    else props.onCreateActivity(data);
    close();
  };

  const submitRecurring = async (list: ActivityInput[]) => {
    setRecurringBusy(true);
    try {
      await props.onCreateActivities(list);
      close();
    } finally {
      setRecurringBusy(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Plan</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your tasks, and when you&apos;ll do them</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModal({ type: 'activity', initialValues: { date: selectedDate } })}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Time block</span>
            </button>
            <button
              onClick={() => setModal({ type: 'recurring' })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium text-sm flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" /> <span className="hidden sm:inline">Recurring</span>
            </button>
          </div>
        </div>
        <Segmented
          className="mt-4 xl:hidden"
          value={pane}
          onChange={setPane}
          options={[{ id: 'timeline', label: 'Timeline' }, { id: 'tasks', label: `Tasks (${tasks.filter(t => t.status !== 'completed').length})` }]}
        />
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-5">
        <section aria-label="Timeline" className={cn('xl:col-span-3 space-y-4', pane !== 'timeline' && 'hidden xl:block')}>
          <Segmented value={timeline} onChange={setTimeline} options={[{ id: 'week', label: 'Week' }, { id: 'day', label: 'Day' }]} />
          {timeline === 'week' ? (
            <ScheduleCalendar
              goals={goals}
              activities={activities}
              selectedDate={selectedDate}
              onDateSelect={date => { setSelectedDate(date); setTimeline('day'); }}
              onActivityClick={editActivity}
              onActivityStatusChange={props.onActivityStatusChange}
              isMobile={isMobile}
            />
          ) : (
            <DailySchedule
              goals={goals}
              tasks={tasks}
              activities={activities}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              onActivityClick={editActivity}
              onActivityStatusChange={props.onActivityStatusChange}
              onCreateActivity={() => setModal({ type: 'activity', initialValues: { date: selectedDate } })}
              onStartFocus={a => onStartFocus({ scheduleId: a.id, goalId: a.goalId, taskId: a.taskId, label: a.title })}
              isMobile={isMobile}
            />
          )}
        </section>

        <section aria-label="Tasks" className={cn('xl:col-span-2', pane !== 'tasks' && 'hidden xl:block')}>
          <TaskManager
            goals={goals}
            tasks={tasks}
            onCreateTask={props.onCreateTask}
            onUpdateTask={props.onUpdateTask}
            onDeleteTask={props.onDeleteTask}
            onUpdateSubTask={props.onUpdateSubTask}
            onScheduleTask={scheduleTask}
            onStartFocus={task => onStartFocus({ taskId: task.id, goalId: task.goalId, label: task.title })}
            isMobile={isMobile}
          />
        </section>
      </div>

      {modal?.type === 'activity' && (
        <ActivityForm
          goals={goals}
          tasks={tasks}
          activity={modal.activity}
          initialValues={modal.initialValues}
          onSubmit={submitActivity}
          onCancel={close}
          onDelete={modal.activity ? () => { props.onDeleteActivity(modal.activity!.id); close(); } : undefined}
          isMobile={isMobile}
        />
      )}

      {modal?.type === 'recurring' && (
        <RecurringScheduleForm goals={goals} tasks={tasks} onSubmit={submitRecurring} onCancel={close} isMobile={isMobile} />
      )}

      {recurringBusy && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="status" aria-live="polite">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 flex flex-col items-center gap-4 shadow-xl">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-700 dark:text-gray-300 font-medium">Creating recurring sessions…</p>
          </div>
        </div>
      )}
    </div>
  );
}
