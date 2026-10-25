'use client';

import React, { useState } from 'react';
import { X, Save, Calendar, Clock, CheckSquare, Trash2 } from 'lucide-react';
import { Goal, ScheduleActivity, Task } from '@/types';
import { cn } from '@/lib/utils';
import { toDateKey } from '@/lib/dates';
import { submitOnModEnter } from '@/lib/forms';

interface ActivityFormProps {
  goals: Goal[];
  tasks: Task[];
  activity?: ScheduleActivity | null;
  /** Prefill for a new block, e.g. when scheduling an existing task. */
  initialValues?: Partial<Pick<ScheduleActivity, 'title' | 'goalId' | 'taskId' | 'date'>>;
  onSubmit: (activity: Omit<ScheduleActivity, 'id' | 'taskTitle'>) => void;
  onCancel: () => void;
  /** Shown when editing an existing block. */
  onDelete?: () => void;
  isMobile: boolean;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minute}`;
});

export function ActivityForm({ goals, tasks, activity, initialValues, onSubmit, onCancel, onDelete, isMobile }: ActivityFormProps) {
  // The form mounts fresh each time it opens, so props only seed initial state.
  const [formData, setFormData] = useState(() => activity
    ? {
        goalId: activity.goalId || '',
        taskId: activity.taskId || '',
        title: activity.title,
        startTime: activity.startTime,
        endTime: activity.endTime,
        date: activity.date,
        notes: activity.notes || '',
        status: activity.status,
      }
    : {
        goalId: initialValues?.goalId ?? goals[0]?.id ?? '',
        taskId: initialValues?.taskId ?? '',
        title: initialValues?.title ?? '',
        startTime: '09:00',
        endTime: '10:00',
        date: initialValues?.date ?? toDateKey(),
        notes: '',
        status: 'pending' as ScheduleActivity['status'],
      });
  const [errors, setErrors] = useState<Record<string, string>>({});


  const handleTaskChange = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    setFormData(prev => ({
      ...prev,
      taskId,
      // Auto-fill title from task if title is still empty
      title: !prev.title.trim() && task ? task.title : prev.title,
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.title.trim()) e.title = 'Please enter an activity title';
    if (!formData.date) e.date = 'Please select a date';
    if (formData.startTime && formData.endTime) {
      const s = new Date(`2000-01-01T${formData.startTime}`);
      const e2 = new Date(`2000-01-01T${formData.endTime}`);
      if (s >= e2) e.endTime = 'End time must be after start time';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    if (validate()) {
      onSubmit({
        goalId: formData.goalId || undefined,
        taskId: formData.taskId || undefined,
        title: formData.title.trim(),
        startTime: formData.startTime,
        endTime: formData.endTime,
        date: formData.date,
        notes: formData.notes.trim() || undefined,
        status: formData.status,
      });
    }
  };

  const set = (field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      // Unlink a task that doesn't belong to the newly selected goal.
      if (field === 'goalId' && next.taskId) {
        const task = tasks.find(t => t.id === next.taskId);
        if (task?.goalId && value && task.goalId !== value) next.taskId = '';
      }
      return next;
    });
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // Tasks available for linking: not completed, and belong to selected goal (or have no goal)
  const availableTasks = tasks.filter(t =>
    t.status !== 'completed' &&
    (!formData.goalId || !t.goalId || t.goalId === formData.goalId)
  );

  const duration = (() => {
    const s = new Date(`2000-01-01T${formData.startTime}`);
    const e = new Date(`2000-01-01T${formData.endTime}`);
    const h = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
    return h > 0 ? `${h.toFixed(1)}h` : null;
  })();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={cn(
        'bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto',
        isMobile && 'max-w-full mx-2'
      )}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {activity ? 'Edit Activity' : 'Add Activity'}
              </h2>
            </div>
            <button onClick={onCancel} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onKeyDown={submitOnModEnter} onSubmit={handleSubmit} className="space-y-4">
            {/* Goal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Goal Area</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => set('goalId', '')}
                  className={cn(
                    'p-2.5 rounded-lg border-2 text-left transition-all',
                    !formData.goalId
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  )}
                >
                  <span className="text-sm text-gray-500 dark:text-gray-400">No Goal</span>
                </button>
                {goals.map(goal => (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => set('goalId', goal.id)}
                    className={cn(
                      'p-2.5 rounded-lg border-2 text-left transition-all',
                      formData.goalId === goal.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: goal.color }} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{goal.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Linked Task */}
            {availableTasks.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5" />
                    Link to Task
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </span>
                </label>
                <select
                  value={formData.taskId}
                  onChange={e => handleTaskChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No task linked</option>
                  {availableTasks.map(task => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                      {task.priority === 'high' ? ' 🔴' : task.priority === 'medium' ? ' 🟡' : ' 🟢'}
                    </option>
                  ))}
                </select>
                {formData.taskId && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    This block is dedicated to working on that task
                  </p>
                )}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Activity Title</label>
              <input autoFocus
                type="text"
                value={formData.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. Deep work session"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>

            {/* Date + Times */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => set('date', e.target.value)}
                  className="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start</label>
                <select
                  value={formData.startTime}
                  onChange={e => set('startTime', e.target.value)}
                  className="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End</label>
                <select
                  value={formData.endTime}
                  onChange={e => set('endTime', e.target.value)}
                  className="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.endTime && <p className="text-red-500 text-xs mt-1">{errors.endTime}</p>}
              </div>
            </div>

            {duration && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                Duration: <strong className="text-gray-700 dark:text-gray-300">{duration}</strong>
              </div>
            )}

            {/* Status (edit only) */}
            {activity && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
                <select
                  value={formData.status}
                  onChange={e => set('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="skipped">Skipped</option>
                  <option value="rescheduled">Rescheduled</option>
                </select>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={formData.notes}
                onChange={e => set('notes', e.target.value)}
                rows={2}
                placeholder="Any additional context..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              {activity && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="mr-auto px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              )}
              <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2">
                <Save className="w-4 h-4" />
                <span>{activity ? 'Update' : 'Add Activity'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
