'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Zap, CheckSquare, Calendar } from 'lucide-react';
import { Goal } from '@/types';
import { cn } from '@/lib/utils';
import { parseCapture, ParsedCapture, Priority } from '@/lib/captureParser';
import { parseDateKey, toDateKey } from '@/lib/dates';
import { submitOnModEnter } from '@/lib/forms';
import { useDialog } from '@/hooks/useDialog';

interface QuickCaptureProps {
  goals: Goal[];
  onCreateTask: (data: { title: string; priority: string; goalId?: string; dueDate?: string; tags: string[]; estimatedTime?: number }) => Promise<void>;
  onCreateActivity: (data: { title: string; date: string; startTime: string; endTime: string; goalId?: string }) => Promise<void>;
}

type Kind = ParsedCapture['kind'];

// What the user set by hand, which wins over what was read from the text.
interface Choices {
  kind?: Kind;
  goalId?: string;
  priority?: Priority;
  date?: string;
  startTime?: string;
  endTime?: string;
}

const dayLabel = (key: string) => parseDateKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const lengthLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  return [hours && `${hours}h`, minutes % 60 && `${minutes % 60}m`].filter(Boolean).join(' ');
};

export function QuickCapture({ goals, onCreateTask, onCreateActivity }: QuickCaptureProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [choices, setChoices] = useState<Choices>({});
  const [saving, setSaving] = useState(false);
  const dialogRef = useDialog<HTMLDivElement>(() => setOpen(false), open);

  const activeGoals = useMemo(() => goals.filter(g => g.status === 'ACTIVE'), [goals]);
  const parsed = useMemo(() => parseCapture(text, { goals: activeGoals }), [text, activeGoals]);

  const kind = choices.kind ?? parsed.kind;
  const goalId = choices.goalId ?? parsed.goalId ?? '';
  const priority = choices.priority ?? parsed.priority ?? 'medium';
  const date = choices.date ?? parsed.date ?? (kind === 'activity' ? toDateKey() : '');
  const startTime = choices.startTime ?? parsed.startTime ?? '09:00';
  const endTime = choices.endTime ?? parsed.endTime ?? '10:00';
  const title = parsed.title;
  const choose = (change: Choices) => setChoices(current => ({ ...current, ...change }));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(p => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setSaving(true);
    try {
      if (kind === 'task') {
        await onCreateTask({ title, priority, goalId: goalId || undefined, dueDate: date || undefined, tags: parsed.tags, estimatedTime: parsed.estimate });
      } else {
        await onCreateActivity({ title, date, startTime, endTime, goalId: goalId || undefined });
      }
      setText('');
      setChoices({});
      setOpen(false);
    } catch {
      // The failed save already shows a toast. The text stays, to try again.
    } finally {
      setSaving(false);
    }
  };

  const goalName = activeGoals.find(g => g.id === goalId)?.name;
  const preview = [
    kind === 'task' ? 'Task' : 'Time block',
    date && (kind === 'task' ? `due ${dayLabel(date)}` : dayLabel(date)),
    kind === 'activity' && `${startTime}–${endTime}`,
    kind === 'task' && priority !== 'medium' && `${priority} priority`,
    kind === 'task' && parsed.estimate && `about ${lengthLabel(parsed.estimate)}`,
    goalName,
    ...(kind === 'task' ? parsed.tags.map(tag => `#${tag}`) : []),
  ].filter(Boolean).join(' · ');

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all z-30 flex items-center justify-center"
        title="Quick Capture (⌘K)"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[15vh] px-4"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="quick-capture-title" className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-2 border-b border-gray-100 dark:border-gray-700">
              <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 id="quick-capture-title" className="font-semibold text-gray-900 dark:text-white text-sm">Quick Capture</h2>
              <kbd className="ml-auto text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">⌘K</kbd>
              <button aria-label="Close quick capture" onClick={() => setOpen(false)} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-600 rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onKeyDown={submitOnModEnter} onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <input aria-label="What do you want to add?"
                  autoFocus
                  type="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Gym tomorrow 6pm for 45 min"
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <p role="status" className="mt-2 min-h-[2.5rem] text-xs text-gray-600 dark:text-gray-300">
                  {!text.trim()
                    ? 'Try “Finish report by Friday !high #work”. Quotes keep words as they are.'
                    : title
                      ? <><strong className="font-medium text-gray-900 dark:text-white">{title}</strong><span className="block">{preview}</span></>
                      : 'Add a title.'}
                </p>
              </div>

              {/* Type Selector */}
              <div className="flex gap-2">
                {([
                  { value: 'task', label: 'Task', icon: CheckSquare },
                  { value: 'activity', label: 'Time block', icon: Calendar },
                ] as const).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={kind === value}
                    onClick={() => choose({ kind: value })}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all border-2',
                      kind === value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Goal */}
              <select aria-label="Goal"
                value={goalId}
                onChange={e => choose({ goalId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">No goal</option>
                {activeGoals.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>

              {/* Task-specific: priority */}
              {kind === 'task' && (
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={priority === p}
                      onClick={() => choose({ priority: p })}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all border',
                        priority === p
                          ? p === 'high' ? 'bg-red-500 border-red-500 text-white' :
                            p === 'medium' ? 'bg-amber-400 border-amber-400 text-gray-900' :
                            'bg-green-500 border-green-500 text-white'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {kind === 'task' && (
                <div>
                  <label htmlFor="quick-capture-due" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Due date (optional)</label>
                  <input id="quick-capture-due" type="date" value={date} onChange={e => choose({ date: e.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              )}

              {/* Time block: date + times */}
              {kind === 'activity' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
                    <input aria-label="Date" type="date" value={date} onChange={e => choose({ date: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start</label>
                    <input aria-label="Start time" type="time" value={startTime} onChange={e => choose({ startTime: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End</label>
                    <input aria-label="End time" type="time" value={endTime} onChange={e => choose({ endTime: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!title || saving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors text-sm"
              >
                {saving ? 'Saving...' : `Add ${kind === 'task' ? 'Task' : 'Time Block'}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
