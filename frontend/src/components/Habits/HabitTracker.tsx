'use client';

import React, { useState } from 'react';
import { Plus, CheckCircle2, Circle, Flame, Edit, Trash2, Repeat, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { Habit } from '@/types';
import { cn } from '@/lib/utils';
import { HabitForm } from './HabitForm';
import { toDateKey } from '@/lib/dates';

interface HabitTrackerProps {
  habits: Habit[];
  onCreateHabit: (data: { name: string; description?: string; frequency: string; targetCount: number }) => Promise<void>;
  onUpdateHabit: (id: string, data: { name?: string; description?: string; frequency?: string; targetCount?: number }) => Promise<void>;
  onDeleteHabit: (id: string) => Promise<void>;
  onCompleteHabit: (id: string, date: string) => Promise<void>;
  isMobile: boolean;
}

function HabitCard({
  habit,
  onEdit,
  onDelete,
  onComplete,
}: {
  habit: Habit;
  onEdit: (h: Habit) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const today = toDateKey();

  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return toDateKey(d);
  });

  const completedDates = new Set(habit.completions.map(c => c.date.split('T')[0]));

  const frequencyColor = {
    daily: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300',
    weekly: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300',
    monthly: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-300',
  }[habit.frequency];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Complete toggle */}
          <button
            onClick={() => onComplete(habit.id)}
            className={cn(
              'mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all',
              habit.completedToday
                ? 'bg-emerald-500 text-white shadow-emerald-200 shadow-md'
                : 'border-2 border-gray-300 dark:border-gray-600 text-gray-400 hover:border-emerald-400 hover:text-emerald-500'
            )}
          >
            {habit.completedToday ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={cn('font-semibold text-gray-900 dark:text-white', habit.completedToday && 'line-through text-gray-400 dark:text-gray-500')}>
                {habit.name}
              </h3>
              <span className={cn('px-2 py-0.5 rounded text-xs font-medium capitalize', frequencyColor)}>
                {habit.frequency}
              </span>
            </div>
            {habit.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{habit.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2">
              {habit.streak > 0 && (
                <div className="flex items-center gap-1 text-orange-500">
                  <Flame className="w-4 h-4" />
                  <span className="text-sm font-semibold">{habit.streak} day streak</span>
                </div>
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {habit.totalCompletions} total completions
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setExpanded(p => !p)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onEdit(habit)}
              className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(habit.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 30-day heatmap */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Last 30 days</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {last30Days.map(date => {
              const done = completedDates.has(date);
              const isToday = date === today;
              return (
                <div
                  key={date}
                  title={date}
                  className={cn(
                    'w-6 h-6 rounded-sm flex-shrink-0',
                    done
                      ? 'bg-emerald-500'
                      : 'bg-gray-200 dark:bg-gray-600',
                    isToday && 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800'
                  )}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
            <span>30 days ago</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-600" /> Less
              <div className="w-3 h-3 rounded-sm bg-emerald-500 ml-1" /> More
            </div>
            <span>Today</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function HabitTracker({
  habits,
  onCreateHabit,
  onUpdateHabit,
  onDeleteHabit,
  onCompleteHabit,
  isMobile,
}: HabitTrackerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [filter, setFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');

  const today = toDateKey();

  const handleCreate = async (data: { name: string; description?: string; frequency: string; targetCount: number }) => {
    await onCreateHabit(data);
    setShowForm(false);
  };

  const handleUpdate = async (data: { name?: string; description?: string; frequency?: string; targetCount?: number }) => {
    if (editingHabit) {
      await onUpdateHabit(editingHabit.id, data);
      setEditingHabit(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this habit?')) {
      await onDeleteHabit(id);
    }
  };

  const filteredHabits = filter === 'all' ? habits : habits.filter(h => h.frequency === filter);
  const completedToday = habits.filter(h => h.completedToday).length;
  const totalToday = habits.filter(h => h.frequency === 'daily').length;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">Habits</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Build consistency through daily practice</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            {!isMobile && <span>New Habit</span>}
          </button>
        </div>

        {/* Today's Progress */}
        {totalToday > 0 && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Today&apos;s Progress</span>
              <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">{completedToday}/{totalToday}</span>
            </div>
            <div className="w-full bg-emerald-200 dark:bg-emerald-800 rounded-full h-2">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${totalToday > 0 ? (completedToday / totalToday) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {(['all', 'daily', 'weekly', 'monthly'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-1 px-2 py-1.5 rounded-md text-sm font-medium transition-all capitalize',
                filter === f
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Habit List */}
      <div className="space-y-3">
        {filteredHabits.map(habit => (
          <HabitCard
            key={habit.id}
            habit={habit}
            onEdit={h => setEditingHabit(h)}
            onDelete={handleDelete}
            onComplete={id => onCompleteHabit(id, today)}
          />
        ))}
      </div>

      {/* Empty state */}
      {filteredHabits.length === 0 && (
        <div className="text-center py-16">
          <Repeat className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No habits yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {filter === 'all' ? 'Start building consistency by adding your first habit' : `No ${filter} habits found`}
          </p>
          {filter === 'all' && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Habit</span>
            </button>
          )}
        </div>
      )}

      {/* Create / Edit form */}
      {(showForm || editingHabit) && (
        <HabitForm
          key={editingHabit?.id ?? 'new'}
          habit={editingHabit}
          onSubmit={editingHabit ? handleUpdate : handleCreate}
          onCancel={() => { setShowForm(false); setEditingHabit(null); }}
        />
      )}
    </div>
  );
}
