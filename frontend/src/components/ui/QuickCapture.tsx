'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Zap, CheckSquare, Calendar } from 'lucide-react';
import { Goal } from '@/types';
import { cn } from '@/lib/utils';

interface QuickCaptureProps {
  goals: Goal[];
  onCreateTask: (data: { title: string; priority: string; goalId?: string }) => Promise<void>;
  onCreateActivity: (data: { title: string; date: string; startTime: string; endTime: string; goalId?: string }) => Promise<void>;
}

export function QuickCapture({ goals, onCreateTask, onCreateActivity }: QuickCaptureProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'task' | 'activity'>('task');
  const [title, setTitle] = useState('');
  const [goalId, setGoalId] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(p => !p);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setTitle('');
      setGoalId('');
      setPriority('medium');
      setType('task');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (type === 'task') {
        await onCreateTask({ title: title.trim(), priority, goalId: goalId || undefined });
      } else {
        await onCreateActivity({ title: title.trim(), date, startTime, endTime, goalId: goalId || undefined });
      }
      setTitle('');
      setGoalId('');
      setPriority('medium');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all z-30 flex items-center justify-center"
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-2 border-b border-gray-100 dark:border-gray-700">
              <Zap className="w-5 h-5 text-blue-500" />
              <span className="font-semibold text-gray-900 dark:text-white text-sm">Quick Capture</span>
              <kbd className="ml-auto text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">⌘K</kbd>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {/* Type Selector */}
              <div className="flex gap-2">
                {([
                  { value: 'task', label: 'Task', icon: CheckSquare },
                  { value: 'activity', label: 'Activity', icon: Calendar },
                ] as const).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all border-2',
                      type === value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Title */}
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={type === 'task' ? 'What needs to be done?' : 'What are you scheduling?'}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />

              {/* Goal */}
              <select
                value={goalId}
                onChange={e => setGoalId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">No goal</option>
                {goals.filter(g => g.status === 'ACTIVE').map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>

              {/* Task-specific: priority */}
              {type === 'task' && (
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all border',
                        priority === p
                          ? p === 'high' ? 'bg-red-500 border-red-500 text-white' :
                            p === 'medium' ? 'bg-yellow-500 border-yellow-500 text-white' :
                            'bg-green-500 border-green-500 text-white'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Activity-specific: date + times */}
              {type === 'activity' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start</label>
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End</label>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!title.trim() || saving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors text-sm"
              >
                {saving ? 'Saving...' : `Add ${type === 'task' ? 'Task' : 'Activity'}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
