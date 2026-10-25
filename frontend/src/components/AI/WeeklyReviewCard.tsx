'use client';

import React, { useState } from 'react';
import { Check, Lightbulb, Sparkles, TrendingDown, Trophy } from 'lucide-react';
import { useAiStatus, useGenerateWeeklyReview, useWeeklyReview } from '@/hooks/data/useAi';
import { useGoals } from '@/hooks/data/useGoals';
import { useTaskMutations } from '@/hooks/data/useTasks';
import { Skeleton } from '@/components/ui/Skeleton';
import { addDaysToKey, weekStartKey } from '@/lib/dates';
import { describeError, toast } from '@/lib/toast';
import { aiButtonClass, ChoiceGroup, TurnOnAiHint } from './AiControls';

type Week = 'this' | 'last';

function List({ title, icon: Icon, items, empty }: { title: string; icon: typeof Trophy; items: string[]; empty: string }) {
  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
        <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" /> {title}
      </h3>
      {items.length ? (
        <ul className="mt-1.5 space-y-1 list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
          {items.map(item => <li key={item}>{item}</li>)}
        </ul>
      ) : <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{empty}</p>}
    </div>
  );
}

/** AI review of a week on the Insights page: generated on request, then kept. */
export function WeeklyReviewCard() {
  const ai = useAiStatus();
  const [week, setWeek] = useState<Week>('this');
  const weekStart = week === 'this' ? weekStartKey() : addDaysToKey(weekStartKey(), -7);
  const review = useWeeklyReview(weekStart, ai.configured && ai.enabled);
  const generate = useGenerateWeeklyReview();
  const tasks = useTaskMutations();
  const goals = useGoals().data ?? [];
  const [added, setAdded] = useState<Set<string>>(new Set());

  if (!ai.configured) return null;
  const content = review.data?.content;
  const generating = generate.isPending && generate.variables === weekStart;
  const error = generate.error && generate.variables === weekStart ? describeError(generate.error) : null;

  const addTask = async (title: string, goalId: string | null) => {
    await tasks.create.mutateAsync({ title, priority: 'medium', status: 'todo', tags: [], subtasks: [], goalId: goalId ?? undefined });
    setAdded(prev => new Set(prev).add(title));
    toast.success(`Added “${title}” to your tasks`);
  };

  return (
    <section aria-labelledby="weekly-review-title" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="weekly-review-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" /> Weekly review
        </h2>
        {ai.enabled && (
          <ChoiceGroup label="Week to review" value={week} onChange={setWeek} options={[{ id: 'this', label: 'This week' }, { id: 'last', label: 'Last week' }]} />
        )}
      </div>

      <div className="mt-4">
        {!ai.enabled ? (
          <TurnOnAiHint>Get an AI review of your week: wins, slips, patterns from your daily reviews and priorities for next week.</TurnOnAiHint>
        ) : review.isLoading || generating ? (
          <div role="status" className="space-y-2">
            <span className="sr-only">{generating ? 'Writing your review…' : 'Loading the review…'}</span>
            {generating && <p className="text-sm text-gray-600 dark:text-gray-400">Writing your review…</p>}
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : content ? (
          <div className="space-y-5">
            <p className="text-base font-medium text-gray-900 dark:text-white">{content.headline}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <List title="Wins" icon={Trophy} items={content.wins} empty="Nothing stood out yet." />
              <List title="Slipped" icon={TrendingDown} items={content.slips} empty="Nothing slipped." />
            </div>
            {content.patterns.length > 0 && (
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                  <Lightbulb className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" /> Patterns
                </h3>
                <ul className="mt-1.5 space-y-2">
                  {content.patterns.map(p => (
                    <li key={p.observation} className="text-sm">
                      <p className="text-gray-800 dark:text-gray-200">{p.observation}</p>
                      <p className="text-gray-500 dark:text-gray-400">{p.evidence}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {content.priorities.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Priorities for next week</h3>
                <ul className="mt-2 space-y-2">
                  {content.priorities.map(p => (
                    <li key={p.title} className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{p.title}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {p.why}{p.goalId && goals.find(g => g.id === p.goalId) ? ` · ${goals.find(g => g.id === p.goalId)!.name}` : ''}
                        </p>
                      </div>
                      {added.has(p.title) ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><Check className="w-4 h-4" aria-hidden="true" /> Added</span>
                      ) : (
                        <button type="button" onClick={() => addTask(p.title, p.goalId)} aria-label={`Add as task: ${p.title}`} className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                          Add as task
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Written {new Date(review.data!.generatedAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · AI can make mistakes</span>
              <button type="button" onClick={() => generate.mutate(weekStart)} className="font-medium text-blue-700 dark:text-blue-300 underline">Rewrite</button>
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {week === 'this' ? 'Review the week so far' : 'Review last week'}: what went well, what slipped, patterns between your energy and what got done, and priorities for next week.
            </p>
            <button type="button" onClick={() => generate.mutate(weekStart)} className={`mt-3 ${aiButtonClass}`}>
              <Sparkles className="w-4 h-4" aria-hidden="true" /> Write my review
            </button>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </section>
  );
}
