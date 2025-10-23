'use client';

import React from 'react';
import { X, Edit, Trash2, CheckSquare, Square, Calendar, Target, Flag, Clock, CheckCircle2, Play } from 'lucide-react';
import { Task, Goal, SubTask } from '@/types';
import { cn } from '@/lib/utils';

interface TaskDetailsProps {
  task: Task;
  goal: Goal;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: Task['status']) => void;
  onSubTaskToggle: (taskId: string, subTaskId: string, completed: boolean) => void;
  isMobile: boolean;
}

export function TaskDetails({
  task,
  goal,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onSubTaskToggle,
  isMobile
}: TaskDetailsProps) {
  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
      case 'todo':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
    }
  };

  const getDueDateStatus = (dueDate?: string) => {
    if (!dueDate) return 'no-due-date';
    
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'due-today';
    if (diffDays <= 2) return 'due-soon';
    return 'due-later';
  };

  const getDueDateColor = (dueDate?: string) => {
    const status = getDueDateStatus(dueDate);
    switch (status) {
      case 'overdue':
        return 'text-red-600 dark:text-red-400';
      case 'due-today':
        return 'text-orange-600 dark:text-orange-400';
      case 'due-soon':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'due-later':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  const getDueDateText = (dueDate?: string) => {
    if (!dueDate) return 'No due date';
    
    const status = getDueDateStatus(dueDate);
    const due = new Date(dueDate);
    
    switch (status) {
      case 'overdue':
        return `Overdue by ${Math.abs(Math.ceil((due.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} days`;
      case 'due-today':
        return 'Due today';
      case 'due-soon':
        return `Due in ${Math.ceil((due.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days`;
      case 'due-later':
        return due.toLocaleDateString('en-US', { 
          weekday: 'long',
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
    }
  };

  const completedSubTasks = task.subtasks.filter(st => st.completed).length;
  const totalSubTasks = task.subtasks.length;
  const subTaskProgress = totalSubTasks > 0 ? (completedSubTasks / totalSubTasks) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={cn(
        'bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto',
        isMobile && 'max-w-full mx-4'
      )}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <CheckSquare className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Task Details
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={onEdit}
                className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Task Content */}
          <div className="space-y-6">
            {/* Title and Status */}
            <div>
              <h3 className={cn(
                "text-2xl font-bold text-gray-900 dark:text-white mb-3",
                task.status === 'completed' && "line-through text-gray-500 dark:text-gray-400"
              )}>
                {task.title}
              </h3>
              
              <div className="flex items-center space-x-3 mb-4">
                <span className={cn(
                  'px-3 py-1 rounded-full text-sm font-medium',
                  getPriorityColor(task.priority)
                )}>
                  {task.priority.toUpperCase()} Priority
                </span>
                
                <span className={cn(
                  'px-3 py-1 rounded-full text-sm font-medium',
                  getStatusColor(task.status)
                )}>
                  {task.status.replace('-', ' ')}
                </span>
              </div>
            </div>

            {/* Description */}
            {task.description && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </h4>
                <p className={cn(
                  "text-gray-600 dark:text-gray-400",
                  task.status === 'completed' && "line-through text-gray-400 dark:text-gray-500"
                )}>
                  {task.description}
                </p>
              </div>
            )}

            {/* Goal Information */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Goal Area
              </h4>
              <div className="flex items-center space-x-3">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: goal.color }}
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {goal.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {goal.category} priority • {goal.targetHoursWeekly}h/week target
                  </div>
                </div>
              </div>
            </div>

            {/* Due Date */}
            {task.dueDate && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Due Date
                </h4>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <span className={cn(
                    "font-medium",
                    getDueDateColor(task.dueDate)
                  )}>
                    {getDueDateText(task.dueDate)}
                  </span>
                </div>
              </div>
            )}

            {/* Tags */}
            {task.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-full text-sm"
                    >
                      <Flag className="w-3 h-3" />
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-tasks */}
            {task.subtasks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sub-tasks
                  </h4>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {completedSubTasks} of {totalSubTasks} completed
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${subTaskProgress}%` }}
                    />
                  </div>
                </div>

                {/* Sub-tasks List */}
                <div className="space-y-2">
                  {task.subtasks.map((subTask) => (
                    <div
                      key={subTask.id}
                      className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500"
                    >
                      <button
                        onClick={() => onSubTaskToggle(task.id, subTask.id, !subTask.completed)}
                        className="flex-shrink-0"
                      >
                        {subTask.completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                        )}
                      </button>
                      <span className={cn(
                        "flex-1 text-sm",
                        subTask.completed 
                          ? "text-gray-400 dark:text-gray-500 line-through" 
                          : "text-gray-900 dark:text-white"
                      )}>
                        {subTask.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Task Meta */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Task Information
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Created:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {new Date(task.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                {task.completedAt && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Completed:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {new Date(task.completedAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Sub-tasks:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {totalSubTasks}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Tags:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {task.tags.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-center space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => onStatusChange('todo')}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition-colors',
                  task.status === 'todo'
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                Mark as To Do
              </button>
              <button
                onClick={() => onStatusChange('in-progress')}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition-colors',
                  task.status === 'in-progress'
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                )}
              >
                Mark as In Progress
              </button>
              <button
                onClick={() => onStatusChange('completed')}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition-colors',
                  task.status === 'completed'
                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                )}
              >
                Mark as Completed
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
