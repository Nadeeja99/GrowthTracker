'use client';

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAiStatus, useSuggestMilestones } from '@/hooks/data/useAi';
import { useCoachPanel } from '@/contexts/CoachContext';
import { SuggestedMilestone } from '@/lib/api';
import { parseDateKey } from '@/lib/dates';
import { describeError } from '@/lib/toast';

/** "Suggest milestones" for a goal: the AI proposes, the user picks what to add. */
export function MilestoneSuggestions({ goalId, goalTitle, onAdd }: {
  goalId: string;
  goalTitle: string;
  onAdd: (title: string, targetDate?: string) => Promise<void>;
}) {
  const ai = useAiStatus();
  const coach = useCoachPanel();
  const suggest = useSuggestMilestones();
  const [items, setItems] = useState<SuggestedMilestone[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ai.configured) return null;

  const run = () => {
    if (!ai.enabled) return coach.open();
    setError(null);
    suggest.mutate(goalId, {
      onSuccess: res => {
        const list = res.data!.milestones;
        setItems(list);
        setSelected(new Set(list.map((_, i) => i)));
      },
      onError: err => setError(describeError(err)),
    });
  };

  const add = async () => {
    setAdding(true);
    setError(null);
    try {
      // In order, so the milestones keep the suggested sequence.
      for (const [i, m] of (items ?? []).entries()) {
        if (selected.has(i)) await onAdd(m.title, m.targetDate ?? undefined);
      }
      setItems(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setAdding(false);
    }
  };

  if (!items) {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={run}
          disabled={suggest.isPending}
          aria-label={`Suggest milestones for ${goalTitle}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline disabled:opacity-60"
        >
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          {suggest.isPending ? 'Thinking…' : 'Suggest milestones'}
        </button>
        {error && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-3">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Suggested milestones</p>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">No new milestones to suggest.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((m, i) => (
            <li key={m.title}>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(i)}
                  onChange={e => setSelected(prev => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(i); else next.delete(i);
                    return next;
                  })}
                />
                <span>
                  <span className="text-gray-900 dark:text-white">{m.title}</span>
                  <span className="block text-xs text-gray-600 dark:text-gray-400">
                    {[m.targetDate && `by ${parseDateKey(m.targetDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`, m.why].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        {items.length > 0 && (
          <button type="button" onClick={add} disabled={adding || selected.size === 0} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {adding ? 'Adding…' : `Add ${selected.size}`}
          </button>
        )}
        <button type="button" onClick={() => setItems(null)} className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800">
          Dismiss
        </button>
      </div>
    </div>
  );
}
