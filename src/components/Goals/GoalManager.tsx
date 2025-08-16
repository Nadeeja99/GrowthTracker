'use client';

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Target, Flame, Clock, TrendingUp } from 'lucide-react';
import { Goal } from '@/types';
import { getProgressPercentage, getCategoryBadgeColor, getStreakColor } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { FloatingActionButton } from '@/components/ui/FloatingActionButton';
import { MobileDrawer } from '@/components/ui/MobileDrawer';

interface GoalManagerProps {
  goals: Goal[];
  onCreateGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'currentWeeklyHours' | 'streakDays'>) => void;
  onUpdateGoal: (goalId: string, updates: Partial<Goal>) => void;
  onDeleteGoal: (goalId: string) => void;
  isMobile: boolean;
}

export function GoalManager({ goals, onCreateGoal, onUpdateGoal, onDeleteGoal, isMobile }: GoalManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6',
    category: 'medium' as Goal['category'],
    targetHoursWeekly: 10,
    targetHoursDaily: 1.5,
    priority: 1
  });

  const predefinedColors = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#8B5CF6', // Purple
    '#F97316', // Orange
    '#EF4444', // Red
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F59E0B', // Amber
    '#EC4899', // Pink
    '#6366F1'  // Indigo
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGoal) {
      onUpdateGoal(editingGoal, formData);
      setEditingGoal(null);
    } else {
      onCreateGoal(formData);
    }
    setIsCreating(false);
    resetForm();
  };

  const handleEdit = (goal: Goal) => {
    setFormData({
      name: goal.name,
      color: goal.color,
      category: goal.category,
      targetHoursWeekly: goal.targetHoursWeekly,
      targetHoursDaily: goal.targetHoursDaily,
      priority: goal.priority
    });
    setEditingGoal(goal.id);
    setIsCreating(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      color: '#3B82F6',
      category: 'medium',
      targetHoursWeekly: 10,
      targetHoursDaily: 1.5,
      priority: 1
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingGoal(null);
    resetForm();
  };

  const handleDelete = (goalId: string) => {
    if (window.confirm('Are you sure you want to delete this goal?')) {
      onDeleteGoal(goalId);
    }
  };

  const GoalForm = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Goal Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="e.g., Programming & Development"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as Goal['category'] })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Weekly Target (hours)
            </label>
            <input
              type="number"
              value={formData.targetHoursWeekly}
              onChange={(e) => setFormData({ ...formData, targetHoursWeekly: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="0.5"
              step="0.5"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Daily Target (hours)
          </label>
          <input
            type="number"
            value={formData.targetHoursDaily}
            onChange={(e) => setFormData({ ...formData, targetHoursDaily: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0.1"
            step="0.1"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {predefinedColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData({ ...formData, color })}
                className={cn(
                  'w-8 h-8 rounded-full border-2 transition-all',
                  formData.color === color 
                    ? 'border-gray-900 dark:border-white scale-110' 
                    : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex space-x-3 pt-4">
        <button
          type="submit"
          className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {editingGoal ? 'Update Goal' : 'Create Goal'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className={cn('space-y-4 md:space-y-6', isMobile && 'pb-20')}>
      {/* Header */}
      {!isMobile && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Goal Management</h2>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Goal</span>
          </button>
        </div>
      )}

      {/* Mobile Header */}
      {isMobile && (
        <div className="flex items-center space-x-3 mb-4">
          <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Goals</h2>
        </div>
      )}

      {/* Desktop Create/Edit Form */}
      {!isMobile && isCreating && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingGoal ? 'Edit Goal' : 'Create New Goal'}
          </h3>
          {GoalForm}
        </div>
      )}

      {/* Mobile Drawer Form */}
      {isMobile && (
        <MobileDrawer
          isOpen={isCreating}
          onClose={handleCancel}
          title={editingGoal ? 'Edit Goal' : 'Create New Goal'}
          position="bottom"
        >
          {GoalForm}
        </MobileDrawer>
      )}

      {/* Goals List */}
      <div className={cn(
        'grid gap-4 md:gap-6',
        isMobile 
          ? 'grid-cols-1' 
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      )}>
        {goals.map((goal) => {
          const progressPercentage = getProgressPercentage(goal.currentWeeklyHours, goal.targetHoursWeekly);
          
          return (
            <div
              key={goal.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: goal.color }}
                  />
                  <h3 className={cn(
                    'font-semibold text-gray-900 dark:text-white truncate',
                    isMobile ? 'text-base' : 'text-base'
                  )}>
                    {goal.name}
                  </h3>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(goal)}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'px-2 py-1 rounded font-medium',
                    getCategoryBadgeColor(goal.category),
                    isMobile ? 'text-xs' : 'text-xs'
                  )}>
                    {goal.category.toUpperCase()}
                  </span>
                  <div className="flex items-center space-x-1 text-orange-500">
                    <Flame className="w-4 h-4" />
                    <span className={cn('font-medium', isMobile ? 'text-sm' : 'text-sm')}>
                      {goal.streakDays} days
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className={cn(
                      'font-medium text-gray-700 dark:text-gray-300',
                      isMobile ? 'text-sm' : 'text-sm'
                    )}>
                      Weekly Progress
                    </span>
                    <span className={cn(
                      'font-bold text-gray-900 dark:text-white',
                      isMobile ? 'text-sm' : 'text-sm'
                    )}>
                      {goal.currentWeeklyHours.toFixed(1)}h / {goal.targetHoursWeekly}h
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>

                <div className={cn(
                  'flex items-center justify-between text-gray-500 dark:text-gray-400',
                  isMobile ? 'text-sm' : 'text-sm'
                )}>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{goal.targetHoursDaily}h/day</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="w-4 h-4" />
                    <span>{Math.round(progressPercentage)}%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {goals.length === 0 && !isCreating && (
        <div className="text-center py-12">
          <Target className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h3 className={cn(
            'font-medium text-gray-900 dark:text-white mb-2',
            isMobile ? 'text-base' : 'text-lg'
          )}>
            No goals yet
          </h3>
          <p className={cn(
            'text-gray-500 dark:text-gray-400 mb-6',
            isMobile ? 'text-sm' : 'text-base'
          )}>
            Start by creating your first personal development goal
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your First Goal
          </button>
        </div>
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <FloatingActionButton
          onClick={() => setIsCreating(true)}
          icon={Plus}
        />
      )}
    </div>
  );
}