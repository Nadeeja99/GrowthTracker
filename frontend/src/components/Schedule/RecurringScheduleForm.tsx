'use client';

import React, { useState, useMemo } from 'react';
import { X, Save, RotateCcw, Calendar, CheckSquare, ChevronRight } from 'lucide-react';
import { Goal, ScheduleActivity, Task } from '@/types';
import { cn } from '@/lib/utils';
import { toDateKey } from '@/lib/dates';
import { submitOnModEnter } from '@/lib/forms';

interface RecurringScheduleFormProps {
  goals: Goal[];
  tasks: Task[];
  onSubmit: (activities: Array<Omit<ScheduleActivity, 'id' | 'taskTitle'>>) => void;
  onCancel: () => void;
  isMobile: boolean;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minute}`;
});

const DAYS = [
  { key: 0, label: 'Sun', short: 'S' },
  { key: 1, label: 'Mon', short: 'M' },
  { key: 2, label: 'Tue', short: 'T' },
  { key: 3, label: 'Wed', short: 'W' },
  { key: 4, label: 'Thu', short: 'T' },
  { key: 5, label: 'Fri', short: 'F' },
  { key: 6, label: 'Sat', short: 'S' },
] as const;

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function generateDates(startDate: string, endDate: string, selectedDays: number[]): string[] {
  if (!startDate || !endDate || selectedDays.length === 0) return [];
  const dates: string[] = [];
  let current = startDate;
  const limit = 366; // safety cap
  let count = 0;
  while (current <= endDate && count < limit) {
    const dow = new Date(current + 'T00:00:00').getDay();
    if (selectedDays.includes(dow)) {
      dates.push(current);
    }
    current = addDays(current, 1);
    count++;
  }
  return dates;
}

export function RecurringScheduleForm({ goals, tasks, onSubmit, onCancel, isMobile }: RecurringScheduleFormProps) {
  const today = toDateKey();
  const twoWeeksLater = addDays(today, 13);

  const [title, setTitle] = useState('');
  const [goalId, setGoalId] = useState(goals[0]?.id || '');
  const [taskId, setTaskId] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(twoWeeksLater);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon–Fri default
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  const availableTasks = tasks.filter(t =>
    t.status !== 'completed' &&
    (!goalId || !t.goalId || t.goalId === goalId)
  );

  const previewDates = useMemo(
    () => generateDates(startDate, endDate, selectedDays),
    [startDate, endDate, selectedDays]
  );

  const duration = (() => {
    const s = new Date(`2000-01-01T${startTime}`);
    const e = new Date(`2000-01-01T${endTime}`);
    const h = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
    return h > 0 ? `${h.toFixed(1)}h` : null;
  })();

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Please enter a title';
    if (!startDate) e.startDate = 'Required';
    if (!endDate) e.endDate = 'Required';
    if (startDate && endDate && startDate > endDate) e.endDate = 'End date must be after start date';
    if (selectedDays.length === 0) e.days = 'Select at least one day';
    if (startTime && endTime) {
      const s = new Date(`2000-01-01T${startTime}`);
      const e2 = new Date(`2000-01-01T${endTime}`);
      if (s >= e2) e.endTime = 'End time must be after start time';
    }
    if (previewDates.length === 0) e.days = 'No dates match your selection';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    if (!validate()) return;

    const activities: Array<Omit<ScheduleActivity, 'id' | 'taskTitle'>> = previewDates.map(date => ({
      title: title.trim(),
      goalId: goalId || undefined,
      taskId: taskId || undefined,
      date,
      startTime,
      endTime,
      status: 'pending' as const,
      notes: notes.trim() || undefined,
    }));

    onSubmit(activities);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={cn(
        'bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto',
        isMobile && 'max-w-full mx-2'
      )}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recurring Schedule</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Create multiple entries across a date range</p>
              </div>
            </div>
            <button onClick={onCancel} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onKeyDown={submitOnModEnter} onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Activity Title</label>
              <input
                type="text"
                value={title}
                onChange={e => { setTitle(e.target.value); setErrors(p => ({ ...p, title: '' })); }}
                placeholder="e.g. Morning run, Study session"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>

            {/* Goal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Goal Area</label>
              <select
                value={goalId}
                onChange={e => { setGoalId(e.target.value); setTaskId(''); }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">No goal</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Linked Task */}
            {availableTasks.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5" />
                    Link to Task <span className="text-gray-400 font-normal">(optional)</span>
                  </span>
                </label>
                <select
                  value={taskId}
                  onChange={e => setTaskId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No task linked</option>
                  {availableTasks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date Range</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => { setStartDate(e.target.value); setErrors(p => ({ ...p, startDate: '', endDate: '' })); }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={e => { setEndDate(e.target.value); setErrors(p => ({ ...p, endDate: '' })); }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
                </div>
              </div>
            </div>

            {/* Days of Week */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Repeat On</label>
              <div className="flex gap-2">
                {DAYS.map(day => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => { toggleDay(day.key); setErrors(p => ({ ...p, days: '' })); }}
                    className={cn(
                      'flex-1 h-10 rounded-lg text-sm font-semibold transition-all border-2',
                      selectedDays.includes(day.key)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-300'
                    )}
                    title={day.label}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-1.5">
                <button type="button" onClick={() => setSelectedDays([1, 2, 3, 4, 5])} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Weekdays</button>
                <button type="button" onClick={() => setSelectedDays([0, 6])} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Weekends</button>
                <button type="button" onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Every day</button>
              </div>
              {errors.days && <p className="text-red-500 text-xs mt-1">{errors.days}</p>}
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Time Slot</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start</label>
                  <select
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End</label>
                  <select
                    value={endTime}
                    onChange={e => { setEndTime(e.target.value); setErrors(p => ({ ...p, endTime: '' })); }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.endTime && <p className="text-red-500 text-xs mt-1">{errors.endTime}</p>}
                </div>
              </div>
              {duration && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{duration} per session</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Notes <span className="text-gray-400 font-normal">(optional, applied to all)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any notes for these sessions..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Preview */}
            {previewDates.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <button
                  type="button"
                  onClick={() => setShowPreview(p => !p)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                      {previewDates.length} sessions will be created
                    </span>
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-blue-500 transition-transform', showPreview && 'rotate-90')} />
                </button>

                {showPreview && (
                  <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                    {previewDates.slice(0, 20).map(date => {
                      const d = new Date(date + 'T00:00:00');
                      return (
                        <div key={date} className="flex items-center justify-between text-sm">
                          <span className="text-blue-700 dark:text-blue-300">
                            {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-blue-500 dark:text-blue-400 text-xs">{startTime} – {endTime}</span>
                        </div>
                      );
                    })}
                    {previewDates.length > 20 && (
                      <p className="text-xs text-blue-500 dark:text-blue-400 pt-1">
                        ...and {previewDates.length - 20} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={previewDates.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Create {previewDates.length > 0 ? `${previewDates.length} ` : ''}Sessions</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
