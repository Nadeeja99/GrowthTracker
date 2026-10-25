'use client';

import React, { useState } from 'react';
import { X, Save, Repeat } from 'lucide-react';
import { Habit } from '@/types';
import { cn } from '@/lib/utils';
import { submitOnModEnter } from '@/lib/forms';
import { useDialog } from '@/hooks/useDialog';

interface HabitFormProps {
  habit?: Habit | null;
  onSubmit: (data: { name: string; description?: string; frequency: string; targetCount: number }) => void;
  onCancel: () => void;
}

export function HabitForm({ habit, onSubmit, onCancel }: HabitFormProps) {
  const dialogRef = useDialog<HTMLDivElement>(onCancel);
  // The form mounts fresh each time it opens, so `habit` only seeds initial state.
  const [name, setName] = useState(habit?.name ?? '');
  const [description, setDescription] = useState(habit?.description ?? '');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>(habit?.frequency ?? 'daily');
  const [targetCount, setTargetCount] = useState(habit?.targetCount ?? 1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (targetCount < 1) e.targetCount = 'Target must be at least 1';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({ name: name.trim(), description: description.trim() || undefined, frequency, targetCount });
    }
  };

  const frequencies = [
    { value: 'daily', label: 'Daily', desc: 'Every day' },
    { value: 'weekly', label: 'Weekly', desc: 'Once a week' },
    { value: 'monthly', label: 'Monthly', desc: 'Once a month' },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="habit-form-title" className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <Repeat className="w-4 h-4" />
              </div>
              <h2 id="habit-form-title" className="text-xl font-semibold text-gray-900 dark:text-white">
                {habit ? 'Edit Habit' : 'New Habit'}
              </h2>
            </div>
            <button aria-label="Close"
              onClick={onCancel}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onKeyDown={submitOnModEnter} onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Habit Name</label>
              <input aria-label="Habit name"
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
                placeholder="e.g. Morning meditation"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              {errors.name && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
              <textarea aria-label="Description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Why is this habit important to you?"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Frequency</label>
              <div className="grid grid-cols-3 gap-2">
                {frequencies.map(f => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFrequency(f.value)}
                    className={cn(
                      'p-3 rounded-lg border-2 text-center transition-all',
                      frequency === f.value
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    )}
                  >
                    <div className={cn('font-medium text-sm', frequency === f.value ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-white')}>
                      {f.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Count
                <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">(times per {frequency})</span>
              </label>
              <input aria-label="Target count"
                type="number"
                min={1}
                max={100}
                value={targetCount}
                onChange={e => { setTargetCount(Number(e.target.value)); setErrors(p => ({ ...p, targetCount: '' })); }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.targetCount && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.targetCount}</p>}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{habit ? 'Update' : 'Create'} Habit</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
