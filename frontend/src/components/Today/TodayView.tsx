'use client';

import React, { useState } from 'react';
import {
  Sun, CheckCircle2, Circle, Clock, Target, Repeat,
  ChevronRight, Play, XCircle, SkipForward, Flame, Timer, Check
} from 'lucide-react';
import { Goal, ScheduleActivity, Task, Habit, DailyRating } from '@/types';
import { cn } from '@/lib/utils';
import { WeeklyOverview } from './WeeklyOverview';
import { GoalProgress } from './GoalProgress';
import { toDateKey } from '@/lib/dates';
import { FocusTarget } from '@/contexts/FocusContext';
import { CoachCard } from '@/components/Coach/CoachCard';

interface TodayViewProps {
  goals: Goal[];
  activities: ScheduleActivity[];
  tasks: Task[];
  habits: Habit[];
  dailyRating: DailyRating | null;
  onActivityStatusChange: (id: string, status: ScheduleActivity['status']) => void;
  onTaskStatusChange: (id: string, status: Task['status']) => void;
  onCompleteHabit: (id: string, date: string) => void;
  onSaveDailyRating: (rating: Omit<DailyRating, 'date'>) => Promise<void>;
  onNavigate: (href: string) => void;
  onStartFocus: (target: FocusTarget) => void;
  isMobile: boolean;
}

function RatingSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const emojis = ['', '😞', '😐', '🙂', '😊', '🤩'];
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-lg">{emojis[value] || '—'}</span>
      </div>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            role="radio"
            aria-checked={value === n}
            aria-label={`${label}: ${n} of 5`}
            onClick={() => onChange(n)}
            className={cn(
              'flex-1 h-2 rounded-full transition-all',
              n <= value ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function TodayView({
  goals,
  activities,
  tasks,
  habits,
  dailyRating,
  onActivityStatusChange,
  onTaskStatusChange,
  onCompleteHabit,
  onSaveDailyRating,
  onNavigate,
  onStartFocus,
  isMobile,
}: TodayViewProps) {
  const today = toDateKey();
  const now = new Date();
  const hour = now.getHours();

  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const todayActivities = activities
    .filter(a => a.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const dueTasks = tasks.filter(t =>
    t.status !== 'completed' && (
      !t.dueDate || t.dueDate.split('T')[0] <= today
    )
  ).slice(0, 5);

  const dailyHabits = habits.filter(h => h.frequency === 'daily');

  const [reviewPerformance, setReviewPerformance] = useState(dailyRating?.performance ?? 0);
  const [reviewEnergy, setReviewEnergy] = useState(dailyRating?.energy ?? 0);
  const [reviewMood, setReviewMood] = useState(dailyRating?.mood ?? 0);
  const [reviewNotes, setReviewNotes] = useState(dailyRating?.notes ?? '');
  const [reviewSaved, setReviewSaved] = useState(!!dailyRating);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const getGoalName = (goalId?: string) => goals.find(g => g.id === goalId)?.name;
  const getGoalColor = (goalId?: string) => goals.find(g => g.id === goalId)?.color || '#6B7280';

  const statusIcon = {
    completed: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    'in-progress': <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
    skipped: <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />,
    rescheduled: <SkipForward className="w-4 h-4 text-yellow-500" />,
    pending: <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />,
  };

  const completedActivities = todayActivities.filter(a => a.status === 'completed').length;
  const completedHabits = dailyHabits.filter(h => h.completedToday).length;
  const completedTasksToday = tasks.filter(t => t.status === 'completed' && t.completedAt?.startsWith(today)).length;

  const handleSaveReview = async () => {
    setReviewSaving(true);
    setReviewError(null);
    try {
      await onSaveDailyRating({ performance: reviewPerformance, energy: reviewEnergy, mood: reviewMood, notes: reviewNotes });
      setReviewSaved(true);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Could not save your review');
    } finally {
      setReviewSaving(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 max-w-3xl mx-auto">
      {/* Greeting */}
      <header className="pt-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="mt-1 text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">{greeting}</h1>
        <dl className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Blocks done', value: `${completedActivities}/${todayActivities.length}` },
            { label: 'Habits done', value: `${completedHabits}/${dailyHabits.length}` },
            { label: 'Tasks done', value: completedTasksToday },
          ].map(stat => (
            <div key={stat.label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-3">
              <dt className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</dt>
              <dd className="mt-0.5 text-xl font-semibold text-gray-900 dark:text-white tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* First run: nothing set up yet, so point to the three building blocks. */}
      {goals.length === 0 && tasks.length === 0 && habits.length === 0 && (
        <section aria-labelledby="getting-started" className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 p-4 md:p-6">
          <h2 id="getting-started" className="font-semibold text-gray-900 dark:text-white">Get started in three steps</h2>
          <ol className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300 list-decimal list-inside">
            <li><button onClick={() => onNavigate('/goals')} className="font-medium text-blue-700 dark:text-blue-300 hover:underline">Set a goal</button> and how many hours a week it deserves.</li>
            <li><button onClick={() => onNavigate('/plan')} className="font-medium text-blue-700 dark:text-blue-300 hover:underline">Plan a task</button> and drop it on your week as a time block.</li>
            <li><button onClick={() => onNavigate('/habits')} className="font-medium text-blue-700 dark:text-blue-300 hover:underline">Add a habit</button> you want to do every day.</li>
          </ol>
        </section>
      )}

      <CoachCard />

      {/* Today's Schedule */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Today&apos;s Schedule
          </h2>
          <button
            onClick={() => onNavigate('/plan')}
            className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
          >
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {todayActivities.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">No activities scheduled for today</p>
            <button
              onClick={() => onNavigate('/plan')}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Add an activity
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {todayActivities.map(activity => (
              <div
                key={activity.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
              >
                <div
                  className="w-2 h-10 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getGoalColor(activity.goalId) }}
                />
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium text-sm text-gray-900 dark:text-white', activity.status === 'completed' && 'line-through text-gray-500 dark:text-gray-400')}>
                    {activity.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {activity.startTime} – {activity.endTime}
                    {activity.goalId && ` · ${getGoalName(activity.goalId)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {statusIcon[activity.status]}
                  {(activity.status === 'pending' || activity.status === 'in-progress') && (
                    <button
                      onClick={() => onStartFocus({ scheduleId: activity.id, goalId: activity.goalId, taskId: activity.taskId, label: activity.title })}
                      aria-label={`Focus on ${activity.title}`}
                      className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                    >
                      <Timer className="w-4 h-4" />
                    </button>
                  )}
                  {activity.status === 'pending' && (
                    <button
                      onClick={() => onActivityStatusChange(activity.id, 'completed')}
                      aria-label={`Mark done: ${activity.title}`}
                      // An action, not a status: outlined, with a verb, so it doesn't read as "already done".
                      className="flex items-center gap-1 text-xs font-medium px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" /> Mark done
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily Habits */}
      {dailyHabits.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Repeat className="w-5 h-5 text-green-500" />
              Habits
            </h2>
            <button
              onClick={() => onNavigate('/habits')}
              className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
            >
              Manage <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {dailyHabits.map(habit => (
              <div key={habit.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <button aria-label={habit.completedToday ? `${habit.name}: done today` : `Mark ${habit.name} done for today`} aria-pressed={habit.completedToday}
                  onClick={() => onCompleteHabit(habit.id, today)}
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                    habit.completedToday
                      ? 'bg-emerald-500 text-white'
                      : 'border-2 border-gray-300 dark:border-gray-600 hover:border-emerald-400 text-gray-500 dark:text-gray-400 hover:text-emerald-500'
                  )}
                >
                  {habit.completedToday ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium text-gray-900 dark:text-white', habit.completedToday && 'line-through text-gray-500 dark:text-gray-400')}>
                    {habit.name}
                  </p>
                </div>
                {habit.streak > 0 && (
                  <div className="flex items-center gap-1 text-orange-700 dark:text-orange-400 text-xs font-semibold flex-shrink-0">
                    <Flame className="w-3 h-3" />
                    {habit.streak}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Due Tasks */}
      {dueTasks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Tasks Due
            </h2>
            <button
              onClick={() => onNavigate('/plan')}
              className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
            >
              All tasks <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {dueTasks.map(task => {
              const isOverdue = task.dueDate && task.dueDate.split('T')[0] < today;
              return (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <button aria-label={task.status === 'completed' ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`} aria-pressed={task.status === 'completed'}
                    onClick={() => onTaskStatusChange(task.id, task.status === 'completed' ? 'todo' : 'completed')}
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                      task.status === 'completed'
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400'
                    )}
                  >
                    {task.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium text-gray-900 dark:text-white truncate', task.status === 'completed' && 'line-through text-gray-500 dark:text-gray-400')}>
                      {task.title}
                    </p>
                    {task.dueDate && (
                      <p className={cn('text-xs', isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400')}>
                        Due {isOverdue ? 'overdue' : task.dueDate.split('T')[0]}
                      </p>
                    )}
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded font-medium flex-shrink-0',
                    task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                    task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  )}>
                    {task.priority}
                  </span>
                  <button
                    onClick={() => onStartFocus({ taskId: task.id, goalId: task.goalId, label: task.title })}
                    aria-label={`Focus on ${task.title}`}
                    className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors flex-shrink-0"
                  >
                    <Timer className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Review */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-500" />
          Daily Review
          {reviewSaved && (
            <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400 font-normal">✓ Saved</span>
          )}
        </h2>
        <div className="space-y-4">
          <RatingSlider label="Performance" value={reviewPerformance} onChange={v => { setReviewPerformance(v); setReviewSaved(false); }} />
          <RatingSlider label="Energy" value={reviewEnergy} onChange={v => { setReviewEnergy(v); setReviewSaved(false); }} />
          <RatingSlider label="Mood" value={reviewMood} onChange={v => { setReviewMood(v); setReviewSaved(false); }} />
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea aria-label="Review notes"
              value={reviewNotes}
              onChange={e => { setReviewNotes(e.target.value); setReviewSaved(false); }}
              placeholder="What went well? What could be better?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
            />
          </div>
          {reviewError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{reviewError}</p>
          )}
          <button
            onClick={handleSaveReview}
            disabled={reviewSaved || reviewSaving}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors text-sm"
          >
            {reviewSaving ? 'Saving…' : reviewSaved ? 'Review saved ✓' : 'Save Review'}
          </button>
        </div>
      </div>

      {/* This Week */}
      <WeeklyOverview goals={goals} activities={activities} isMobile={isMobile} />
      {goals.length > 0 && (
        <GoalProgress goals={goals} onGoalClick={() => onNavigate('/goals')} isMobile={isMobile} />
      )}
    </div>
  );
}
