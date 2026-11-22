'use client';

import { History } from 'lucide-react';
import { EstimateParams } from '@/lib/api';
import { useEstimate } from '@/hooks/data/useEstimate';
import { cn } from '@/lib/utils';
import { lengthLabel } from '@/lib/dates';

interface EstimateSuggestionProps {
  /** null while the estimate field is empty or invalid. */
  params: EstimateParams | null;
  onUse: (minutes: number) => void;
}

/** Close enough that suggesting a change would be noise. */
const matches = (suggested: number, typed: number) => Math.abs(suggested - typed) <= Math.max(5, typed * 0.1);

/**
 * "Tasks like this usually take you about…", from the estimate-calibration
 * model applied to the person's own finished, timed tasks.
 */
export function EstimateSuggestion({ params, onUse }: EstimateSuggestionProps) {
  const { data, isCurrent } = useEstimate(params);
  if (!params || !data) return null;

  const tasksWord = (n: number) => (n === 1 ? 'task' : 'tasks');
  let body: React.ReactNode;

  if (!data.estimate) {
    const needed = Math.max(data.minHistory - data.timedTasks, 1);
    body = (
      <p>
        Finish {needed} more timed {tasksWord(needed)} and GrowthTracker will start learning how long your tasks really take.
        Time a task with the focus timer to log it.
      </p>
    );
  } else {
    const e = data.estimate;
    const basis = `Based on your last ${e.basedOn.tasks} finished timed ${tasksWord(e.basedOn.tasks)}${
      e.basedOn.goalTasks ? `, ${e.basedOn.goalTasks} for this goal` : ''
    }.`;
    body = matches(e.suggestedMinutes, e.minutes) ? (
      <p>
        That matches how long tasks like this usually take you. <span className="text-gray-500 dark:text-gray-400">{basis}</span>
      </p>
    ) : (
      <div className="space-y-2">
        <p>
          Tasks like this usually take you about <strong className="font-semibold">{lengthLabel(e.suggestedMinutes)}</strong>;
          {' '}{Math.round(e.coverage * 10)} in 10 take between {lengthLabel(e.lowMinutes)} and {lengthLabel(e.highMinutes)}.{' '}
          <span className="text-gray-500 dark:text-gray-400">{basis}</span>
        </p>
        <button
          type="button"
          onClick={() => onUse(e.suggestedMinutes)}
          disabled={!isCurrent}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 disabled:opacity-60 transition-colors"
        >
          Use {lengthLabel(e.suggestedMinutes)}
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy={!isCurrent}
      className={cn(
        'mt-2 flex gap-2 rounded-lg p-3 text-sm bg-blue-50 dark:bg-blue-900/20 text-gray-800 dark:text-gray-200 transition-opacity',
        !isCurrent && 'opacity-60',
      )}
    >
      <History className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      {body}
    </div>
  );
}
