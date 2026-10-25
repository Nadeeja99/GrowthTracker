'use client';

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, X } from 'lucide-react';
import { useAiStatus, usePlanWeek } from '@/hooks/data/useAi';
import { useGoals } from '@/hooks/data/useGoals';
import { useDialog } from '@/hooks/useDialog';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useCoachPanel } from '@/contexts/CoachContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiClient, PlannedBlock } from '@/lib/api';
import { addDaysToKey, toDateKey, weekStartKey } from '@/lib/dates';
import { queryKeys } from '@/lib/queryKeys';
import { describeError, toast } from '@/lib/toast';
import { aiButtonClass, ChoiceGroup } from './AiControls';

type Week = 'this' | 'next';
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const inputClass = 'mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm';

function PlanWeekDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialog<HTMLDivElement>(onClose);
  const queryClient = useQueryClient();
  const goals = useGoals().data ?? [];
  const plan = usePlanWeek();
  const [week, setWeek] = useState<Week>(() => (new Date().getDay() >= 5 ? 'next' : 'this'));
  const [range, setRange] = useLocalStorage('plan-week-window', { start: '07:00', end: '21:00' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const weekStart = week === 'this' ? weekStartKey() : addDaysToKey(weekStartKey(), 7);
  const blocks = plan.data?.data?.plan.blocks;
  const byDay = useMemo(() => {
    const days = new Map<string, PlannedBlock[]>();
    for (const b of blocks ?? []) {
      const key = toDateKey(new Date(b.startTime));
      days.set(key, [...(days.get(key) ?? []), b]);
    }
    return [...days.entries()];
  }, [blocks]);

  const run = () => {
    setAddError(null);
    plan.mutate({ weekStart, window: range }, { onSuccess: res => setSelected(new Set(res.data!.plan.blocks.map(b => b.id))) });
  };

  const add = async () => {
    const chosen = (blocks ?? []).filter(b => selected.has(b.id));
    setAdding(true);
    setAddError(null);
    try {
      await apiClient.createSchedulesBulk(chosen.map(b => ({ title: b.title, startTime: b.startTime, endTime: b.endTime, goalId: b.goalId ?? undefined })));
      await queryClient.invalidateQueries({ queryKey: queryKeys.schedules });
      toast.success(`Added ${chosen.length} ${chosen.length === 1 ? 'block' : 'blocks'} to your week`);
      onClose();
    } catch (error) {
      setAddError(describeError(error));
    } finally {
      setAdding(false);
    }
  };

  const goal = (id: string | null) => goals.find(g => g.id === id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="plan-week-title" className="relative w-full sm:max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="plan-week-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" /> Plan my week
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Suggests time blocks that move each goal towards its weekly target, in free time that doesn&apos;t clash with your plan. You choose which to add.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <ChoiceGroup label="Week" value={week} onChange={w => { setWeek(w); plan.reset(); }} options={[{ id: 'this', label: 'This week' }, { id: 'next', label: 'Next week' }]} />
            <div className="flex gap-3">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Earliest
                <input type="time" value={range.start} onChange={e => setRange({ ...range, start: e.target.value })} className={inputClass} />
              </label>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Latest
                <input type="time" value={range.end} onChange={e => setRange({ ...range, end: e.target.value })} className={inputClass} />
              </label>
            </div>
          </div>

          {plan.isPending ? (
            <div role="status" className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Planning your week…</p>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : blocks ? (
            <div className="space-y-4">
              {plan.data?.data?.plan.summary && <p className="text-sm text-gray-800 dark:text-gray-200">{plan.data.data.plan.summary}</p>}
              {blocks.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-400">No blocks to suggest for this week.</p>}
              {byDay.map(([day, items]) => (
                <fieldset key={day}>
                  <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                  </legend>
                  <ul className="mt-1.5 space-y-1.5">
                    {items.map(b => (
                      <li key={b.id}>
                        <label className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <input
                            type="checkbox"
                            checked={selected.has(b.id)}
                            onChange={e => setSelected(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(b.id); else next.delete(b.id);
                              return next;
                            })}
                            className="mt-1"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                              {goal(b.goalId) && <span aria-hidden="true" className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: goal(b.goalId)!.color }} />}
                              <span className="tabular-nums text-gray-600 dark:text-gray-300">{time(b.startTime)}–{time(b.endTime)}</span>
                              <span className="truncate">{b.title}</span>
                            </span>
                            <span className="block text-xs text-gray-600 dark:text-gray-400">
                              {[goal(b.goalId)?.name, b.reason].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ))}
            </div>
          ) : null}
          {plan.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{describeError(plan.error)}</p>}
          {addError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{addError}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          {blocks && blocks.length > 0 ? (
            <>
              <button type="button" onClick={run} disabled={plan.isPending || adding} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60">
                Try again
              </button>
              <button type="button" onClick={add} disabled={selected.size === 0 || adding} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {adding ? 'Adding…' : `Add ${selected.size} ${selected.size === 1 ? 'block' : 'blocks'}`}
              </button>
            </>
          ) : (
            <button type="button" onClick={run} disabled={plan.isPending} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {plan.isPending ? 'Planning…' : 'Suggest blocks'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** "Plan my week" button for the Plan page (hidden when the server has no AI). */
export function PlanWeekButton() {
  const ai = useAiStatus();
  const coach = useCoachPanel();
  const [open, setOpen] = useState(false);
  if (!ai.configured) return null;

  return (
    <>
      <button type="button" onClick={() => (ai.enabled ? setOpen(true) : coach.open())} className={aiButtonClass}>
        <Sparkles className="w-4 h-4" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Plan my week</span>
      </button>
      {open && <PlanWeekDialog onClose={() => setOpen(false)} />}
    </>
  );
}
