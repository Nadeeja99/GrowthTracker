'use client';

import React from 'react';
import { Play, Pause, RotateCcw, SkipForward, Timer, Coffee, Zap } from 'lucide-react';
import { FocusSession, Goal, Task } from '@/types';
import { useFocus } from '@/contexts/FocusContext';
import { toDateKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

interface FocusTimerProps {
  goals: Goal[];
  tasks: Task[];
  focusSessions: FocusSession[];
}

// The timer itself lives in FocusContext so it survives navigation; this
// component is the full-size control surface shown in the focus panel.
export function FocusTimer({ goals, tasks, focusSessions }: FocusTimerProps) {
  const { timer, target, setTarget, saveError } = useFocus();
  const selectedGoalId = target.goalId ?? '';
  const selectedTaskId = target.taskId ?? '';
  // Choosing a goal/task by hand detaches the session from any planned block.
  const setSelectedGoalId = (goalId: string) => setTarget({ goalId: goalId || undefined });
  const setSelectedTaskId = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    setTarget({ goalId: task?.goalId ?? (selectedGoalId || undefined), taskId: taskId || undefined });
  };

  const {
    isRunning,
    currentSession,
    cycleCount,
    progress,
    startTimer,
    pauseTimer,
    resetTimer,
    skipSession,
    switchSession,
    formatTime,
  } = timer;

  const today = toDateKey();
  const todaysSessions = focusSessions.filter(s => toDateKey(new Date(s.startedAt)) === today);
  const todaysMinutes = Math.round(todaysSessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60);

  const sessionConfig = {
    // Focus uses the app's accent; breaks use a calm green.
    work: { label: 'Focus', button: 'bg-blue-600 hover:bg-blue-700', stroke: 'stroke-blue-600 dark:stroke-blue-400', textColor: 'text-blue-600 dark:text-blue-400', icon: Zap },
    break: { label: 'Short Break', button: 'bg-emerald-600 hover:bg-emerald-700', stroke: 'stroke-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', icon: Coffee },
    longBreak: { label: 'Long Break', button: 'bg-emerald-600 hover:bg-emerald-700', stroke: 'stroke-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', icon: Coffee },
  };

  const session = sessionConfig[currentSession];
  const SessionIcon = session.icon;

  const circumference = 2 * Math.PI * 120;
  const dashOffset = circumference * (1 - progress);

  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const goalTasks = selectedGoalId ? activeTasks.filter(t => t.goalId === selectedGoalId) : activeTasks;

  return (
    <div className="space-y-6">
      {/* Timer Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:p-8">
        {/* Session Tabs */}
        <div className="flex items-center justify-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1 mb-8">
          {(['work', 'break', 'longBreak'] as const).map(s => (
            <button
              key={s}
              onClick={() => switchSession(s)}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                currentSession === s
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
            >
              {sessionConfig[s].label}
            </button>
          ))}
        </div>

        {/* Circular Timer */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-64 h-64">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
              {/* Background circle */}
              <circle
                cx="130" cy="130" r="120"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-gray-100 dark:text-gray-700"
              />
              {/* Progress circle */}
              <circle
                cx="130" cy="130" r="120"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className={cn('transition-all duration-1000', session.stroke)}
              />
            </svg>

            {/* Timer Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <SessionIcon className={cn('w-6 h-6 mb-2', session.textColor)} />
              <span className="text-5xl font-mono font-bold text-gray-900 dark:text-white tabular-nums">
                {formatTime()}
              </span>
              <span className={cn('text-sm font-medium mt-2', session.textColor)}>
                {session.label}
              </span>
            </div>
          </div>

          {/* Session Counter */}
          <div className="flex items-center gap-2 mt-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'w-3 h-3 rounded-full transition-all',
                  i < (cycleCount % 4) ? 'bg-blue-600 dark:bg-blue-400' : 'bg-gray-200 dark:bg-gray-600'
                )}
              />
            ))}
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
              {todaysMinutes} min focused today · {todaysSessions.length} {todaysSessions.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>
        </div>

        {saveError && (
          <p role="alert" className="mb-4 text-center text-sm text-red-600 dark:text-red-400">{saveError}</p>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center space-x-4">
          <button aria-label="Reset timer"
            onClick={resetTimer}
            className="w-12 h-12 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button aria-label={isRunning ? 'Pause timer' : 'Start timer'}
            onClick={isRunning ? pauseTimer : startTimer}
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center text-white shadow-sm transition-colors active:scale-95',
              session.button
            )}
          >
            {isRunning
              ? <Pause className="w-8 h-8" />
              : <Play className="w-8 h-8 ml-1" />
            }
          </button>

          <button aria-label="Skip to the next session"
            onClick={skipSession}
            className="w-12 h-12 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Context: Goal & Task */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <Timer className="w-4 h-4" />
          Working on
        </h3>
        {target.scheduleId && target.label && (
          <p className="-mt-2 mb-4 text-sm text-gray-600 dark:text-gray-300">
            Planned block: <span className="font-medium">{target.label}</span>
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Goal</label>
            <select aria-label="Goal"
              value={selectedGoalId}
              onChange={e => setSelectedGoalId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">No goal selected</option>
              {goals.filter(g => g.status === 'ACTIVE').map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Task</label>
            <select aria-label="Task"
              value={selectedTaskId}
              onChange={e => setSelectedTaskId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">No task selected</option>
              {goalTasks.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-xl p-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {currentSession === 'work'
            ? 'Stay with one task. Close what you don’t need.'
            : currentSession === 'break'
            ? 'Short break: stand up, stretch, drink some water.'
            : 'Long break: step away from the screen for a while.'}
        </p>
      </div>
    </div>
  );
}
