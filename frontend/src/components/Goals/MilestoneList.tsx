'use client';

import React, { useState } from 'react';
import { CheckCircle2, Circle, Plus, X } from 'lucide-react';
import { Milestone } from '@/types';
import { cn } from '@/lib/utils';

interface MilestoneListProps {
  milestones: Milestone[];
  onAdd: (title: string) => Promise<void>;
  onToggle: (milestoneId: string, completed: boolean) => Promise<void>;
  onDelete: (milestoneId: string) => Promise<void>;
}

// Milestones break a goal into checkpoints; completing them drives the goal's progress.
export function MilestoneList({ milestones, onAdd, onToggle, onDelete }: MilestoneListProps) {
  const [title, setTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setIsAdding(true);
    await run(async () => {
      await onAdd(trimmed);
      setTitle('');
    });
    setIsAdding(false);
  };

  const completed = milestones.filter(m => m.completed).length;

  return (
    <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Milestones</span>
        {milestones.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{completed}/{milestones.length} done</span>
        )}
      </div>

      {milestones.length > 0 && (
        <ul className="space-y-1 mb-2">
          {milestones.map(milestone => (
            <li key={milestone.id} className="group flex items-center gap-2">
              <button
                type="button"
                onClick={() => run(() => onToggle(milestone.id, !milestone.completed))}
                aria-label={milestone.completed ? `Mark "${milestone.title}" as not done` : `Mark "${milestone.title}" as done`}
                className="flex-shrink-0 text-gray-400 hover:text-emerald-500"
              >
                {milestone.completed
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  : <Circle className="w-4 h-4" />}
              </button>
              <span className={cn(
                'flex-1 text-sm truncate',
                milestone.completed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'
              )}>
                {milestone.title}
              </span>
              <button
                type="button"
                onClick={() => run(() => onDelete(milestone.id))}
                aria-label={`Delete milestone "${milestone.title}"`}
                className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Add a milestone"
          maxLength={200}
          aria-label="New milestone title"
          className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
        />
        <button
          type="submit"
          disabled={isAdding || !title.trim()}
          aria-label="Add milestone"
          className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
    </div>
  );
}
