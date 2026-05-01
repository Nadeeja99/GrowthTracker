'use client';

import React, { useState } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Timer, Coffee, Zap, Settings } from 'lucide-react';
import { Goal, Task } from '@/types';
import { useTimer } from '@/hooks/useTimer';
import { cn } from '@/lib/utils';

interface FocusTimerProps {
  goals: Goal[];
  tasks: Task[];
  isMobile: boolean;
}

export function FocusTimer({ goals, tasks, isMobile }: FocusTimerProps) {
  const {
    timeRemaining,
    isRunning,
    currentSession,
    cycleCount,
    completedSessions,
    progress,
    startTimer,
    pauseTimer,
    resetTimer,
    skipSession,
    switchSession,
    formatTime,
  } = useTimer();

  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');

  const sessionConfig = {
    work: { label: 'Focus', color: 'from-red-500 to-pink-600', textColor: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', icon: Zap },
    break: { label: 'Short Break', color: 'from-blue-500 to-cyan-500', textColor: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: Coffee },
    longBreak: { label: 'Long Break', color: 'from-green-500 to-emerald-500', textColor: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', icon: Coffee },
  };

  const session = sessionConfig[currentSession];
  const SessionIcon = session.icon;

  const circumference = 2 * Math.PI * 120;
  const dashOffset = circumference * (1 - progress);

  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const goalTasks = selectedGoalId ? activeTasks.filter(t => t.goalId === selectedGoalId) : activeTasks;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
                className={cn(
                  'transition-all duration-1000',
                  currentSession === 'work' ? 'stroke-red-500' :
                  currentSession === 'break' ? 'stroke-blue-500' : 'stroke-green-500'
                )}
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
                  i < (cycleCount % 4) ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-600'
                )}
              />
            ))}
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
              {completedSessions} sessions today
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={resetTimer}
            className="w-12 h-12 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={isRunning ? pauseTimer : startTimer}
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-105 active:scale-95 bg-gradient-to-br',
              session.color
            )}
          >
            {isRunning
              ? <Pause className="w-8 h-8" />
              : <Play className="w-8 h-8 ml-1" />
            }
          </button>

          <button
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
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Goal</label>
            <select
              value={selectedGoalId}
              onChange={e => { setSelectedGoalId(e.target.value); setSelectedTaskId(''); }}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">No goal selected</option>
              {goals.filter(g => g.status === 'ACTIVE').map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Task</label>
            <select
              value={selectedTaskId}
              onChange={e => setSelectedTaskId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
      <div className={cn('rounded-xl p-4 border', session.bg,
        currentSession === 'work' ? 'border-red-200 dark:border-red-800' :
        currentSession === 'break' ? 'border-blue-200 dark:border-blue-800' :
        'border-green-200 dark:border-green-800'
      )}>
        <p className={cn('text-sm font-medium', session.textColor)}>
          {currentSession === 'work'
            ? '🎯 Stay focused. Close distractions and work on a single task.'
            : currentSession === 'break'
            ? '☕ Take a short break. Stretch, breathe, or grab water.'
            : '🌿 Great work! Take a longer break. Step outside or rest your eyes.'}
        </p>
      </div>
    </div>
  );
}
