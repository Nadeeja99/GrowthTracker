'use client';

import React from 'react';
import { Timer, X } from 'lucide-react';
import { useFocus } from '@/contexts/FocusContext';
import { useGoals } from '@/hooks/data/useGoals';
import { useTasks } from '@/hooks/data/useTasks';
import { useFocusSessions } from '@/hooks/data/useFocusSessions';
import { cn } from '@/lib/utils';
import { FocusTimer } from './FocusTimer';
import { useDialog } from '@/hooks/useDialog';

/** Slide-over that hosts the focus timer; the timer keeps running when it's closed. */
export function FocusPanel() {
  const { isOpen, close } = useFocus();
  const goals = useGoals().data ?? [];
  const tasks = useTasks().data ?? [];
  const sessions = useFocusSessions().data ?? [];

  const dialogRef = useDialog<HTMLDivElement>(close, isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="focus-panel-title" className="relative w-full sm:max-w-md h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 id="focus-panel-title" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Timer className="w-5 h-5" /> Focus
          </h2>
          <button
            onClick={close}
            aria-label="Close focus timer (keeps running)"
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <FocusTimer goals={goals} tasks={tasks} focusSessions={sessions} />
      </div>
    </div>
  );
}

/** Header control: opens the panel, and shows the countdown while a session is active. */
export function FocusButton() {
  const { timer, open } = useFocus();
  const active = timer.isRunning || timer.progress > 0;

  return (
    <button
      onClick={open}
      aria-label={active ? `Focus timer, ${timer.formatTime()} remaining` : 'Open focus timer'}
      className={cn(
        'flex items-center gap-1.5 p-2 rounded-lg transition-colors text-sm font-medium',
        active
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
      )}
    >
      <Timer className="w-5 h-5" />
      {active && <span className="tabular-nums">{timer.formatTime()}</span>}
    </button>
  );
}
