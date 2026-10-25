'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useCoachPanel } from '@/contexts/CoachContext';

/** A small pair/group of toggle buttons (e.g. "This week" / "Last week"). */
export function ChoiceGroup<T extends string>({ label, value, options, onChange, className }: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1', className)}>
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'px-3 py-1 rounded-md text-sm font-medium transition-colors',
            value === option.id
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Shown in place of an AI action until the user has opted in. */
export function TurnOnAiHint({ children }: { children: React.ReactNode }) {
  const { open } = useCoachPanel();
  return (
    <p className="text-sm text-gray-600 dark:text-gray-400">
      {children}{' '}
      <button type="button" onClick={() => open()} className="font-medium text-blue-700 dark:text-blue-300 underline">
        Turn on the AI Coach
      </button>{' '}
      to use it.
    </p>
  );
}

export const aiButtonClass =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-60';
