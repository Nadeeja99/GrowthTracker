'use client';

import React, { useState, useMemo } from 'react';
import { CheckSquare, Square, Plus, Filter, Search, Calendar, Target, Flag, Clock, Edit, Trash2, MoreVertical, CheckCircle2, XCircle, Play } from 'lucide-react';
import { Task, Goal, SubTask } from '@/types';
import { cn } from '@/lib/utils';
import { TaskForm } from './TaskForm';
import { TaskDetails } from './TaskDetails';

interface TaskManagerProps {
  goals: Goal[];
  tasks: Task[];
  onCreateTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateSubTask: (taskId: string, subTaskId: string, updates: Partial<SubTask>) => void;
  isMobile: boolean;
}

type TaskFilter = 'all' | 'todo' | 'in-progress' | 'completed';
type TaskPriority = 'high' | 'medium' | 'low';
type TaskSort = 'dueDate' | 'priority' | 'createdAt' | 'title';

export function TaskManager({
  goals,
  tasks,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onUpdateSubTask,
  isMobile
}: TaskManagerProps) {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [goalFilter, setGoalFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<TaskSort>('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      
      // Priority filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      
      // Goal filter
      if (goalFilter !== 'all' && task.goalId !== goalFilter) return false;
      
      // Search query
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !task.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'dueDate':
          aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [tasks, statusFilter, priorityFilter, goalFilter, searchQuery, sortBy, sortOrder]);

  const handleCreateTask = () => {
    setEditingTask(null);
    setShowTaskForm(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleTaskSubmit = (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    if (editingTask) {
      onUpdateTask(editingTask.id, taskData);
    } else {
      onCreateTask(taskData);
    }
    setShowTaskForm(false);
    setEditingTask(null);
  };

  const handleDeleteTask = (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      onDeleteTask(taskId);
    }
  };

  const handleStatusChange = (taskId: string, status: Task['status']) => {
    onUpdateTask(taskId, { status });
  };

  const handleSubTaskToggle = (taskId: string, subTaskId: string, completed: boolean) => {
    onUpdateSubTask(taskId, subTaskId, { completed });
  };

  const getGoalColor = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    return goal?.color || '#6B7280';
  };

  const getGoalName = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    return goal?.name || 'Unknown Goal';
  };

  const getPriorityColor = (priority: TaskPriority) => {
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

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'in-progress':
        return <Play className="w-4 h-4" />;
      case 'todo':
        return <Square className="w-4 h-4" />;
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
        return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                Task Management
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Organize and track your tasks and to-dos
              </p>
            </div>
          </div>
          
          <button
            onClick={handleCreateTask}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Task</span>
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {completedTasks}
            </div>
            <div className="text-sm text-emerald-600 dark:text-emerald-400">Completed</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {tasks.filter(t => t.status === 'in-progress').length}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">In Progress</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {tasks.filter(t => t.status === 'todo').length}
            </div>
            <div className="text-sm text-orange-600 dark:text-orange-400">To Do</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {completionRate}%
            </div>
            <div className="text-sm text-purple-600 dark:text-purple-400">Completion Rate</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'todo', label: 'To Do' },
                { id: 'in-progress', label: 'In Progress' },
                { id: 'completed', label: 'Completed' }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setStatusFilter(filter.id as TaskFilter)}
                  className={cn(
                    'px-3 py-1 rounded-md text-sm font-medium transition-all duration-200',
                    statusFilter === filter.id
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Priority Filter */}
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {[
                { id: 'all', label: 'All Priorities' },
                { id: 'high', label: 'High' },
                { id: 'medium', label: 'Medium' },
                { id: 'low', label: 'Low' }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setPriorityFilter(filter.id as TaskPriority | 'all')}
                  className={cn(
                    'px-3 py-1 rounded-md text-sm font-medium transition-all duration-200',
                    priorityFilter === filter.id
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Goal Filter */}
            <select
              value={goalFilter}
              onChange={(e) => setGoalFilter(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="all">All Goals</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>{goal.name}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-');
                setSortBy(newSortBy as TaskSort);
                setSortOrder(newSortOrder as 'asc' | 'desc');
              }}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="dueDate-asc">Due Date (Earliest)</option>
              <option value="dueDate-desc">Due Date (Latest)</option>
              <option value="priority-desc">Priority (High to Low)</option>
              <option value="priority-asc">Priority (Low to High)</option>
              <option value="createdAt-desc">Created (Newest)</option>
              <option value="createdAt-asc">Created (Oldest)</option>
              <option value="title-asc">Title (A-Z)</option>
              <option value="title-desc">Title (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredAndSortedTasks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <CheckSquare className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No tasks found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || goalFilter !== 'all'
                ? 'Try adjusting your filters or search terms'
                : 'Create your first task to get started'
              }
            </p>
            {!searchQuery && statusFilter === 'all' && priorityFilter === 'all' && goalFilter === 'all' && (
              <button
                onClick={handleCreateTask}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Create Task</span>
              </button>
            )}
          </div>
        ) : (
          filteredAndSortedTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start space-x-4">
                {/* Status Checkbox */}
                <button
                  onClick={() => handleStatusChange(task.id, task.status === 'completed' ? 'todo' : 'completed')}
                  className="flex-shrink-0 mt-1"
                >
                  {task.status === 'completed' ? (
                    <CheckSquare className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                  )}
                </button>

                {/* Task Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className={cn(
                        "font-semibold text-gray-900 dark:text-white mb-1",
                        task.status === 'completed' && "line-through text-gray-500 dark:text-gray-400"
                      )}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className={cn(
                          "text-gray-600 dark:text-gray-400 text-sm mb-2",
                          task.status === 'completed' && "line-through text-gray-400 dark:text-gray-500"
                        )}>
                          {task.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-3">
                      {/* Priority Badge */}
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        getPriorityColor(task.priority)
                      )}>
                        {task.priority.toUpperCase()}
                      </span>
                      
                      {/* Status Badge */}
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        getStatusColor(task.status)
                      )}>
                        {task.status.replace('-', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Task Meta */}
                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                    {/* Goal */}
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getGoalColor(task.goalId) }}
                      />
                      <span>{getGoalName(task.goalId)}</span>
                    </div>

                    {/* Due Date */}
                    {task.dueDate && (
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span className={getDueDateColor(task.dueDate)}>
                          {getDueDateText(task.dueDate)}
                        </span>
                      </div>
                    )}

                    {/* Tags */}
                    {task.tags.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <Flag className="w-4 h-4" />
                        <span>{task.tags.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Sub-tasks */}
                  {task.subtasks.length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Sub-tasks ({task.subtasks.filter(st => st.completed).length}/{task.subtasks.length})
                      </div>
                      <div className="space-y-1">
                        {task.subtasks.map((subTask) => (
                          <div key={subTask.id} className="flex items-center space-x-2">
                            <button
                              onClick={() => handleSubTaskToggle(task.id, subTask.id, !subTask.completed)}
                              className="flex-shrink-0"
                            >
                              {subTask.completed ? (
                                <CheckSquare className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                              )}
                            </button>
                            <span className={cn(
                              "text-sm",
                              subTask.completed 
                                ? "text-gray-400 dark:text-gray-500 line-through" 
                                : "text-gray-600 dark:text-gray-400"
                            )}>
                              {subTask.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progress Bar for Sub-tasks */}
                  {task.subtasks.length > 0 && (
                    <div className="mb-3">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${(task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button
                    onClick={() => setSelectedTask(task)}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditTask(task)}
                    className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Task Form Modal */}
      {showTaskForm && (
        <TaskForm
          goals={goals}
          task={editingTask}
          onSubmit={handleTaskSubmit}
          onCancel={() => {
            setShowTaskForm(false);
            setEditingTask(null);
          }}
          isMobile={isMobile}
        />
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetails
          task={selectedTask}
          goal={goals.find(g => g.id === selectedTask.goalId)!}
          onClose={() => setSelectedTask(null)}
          onEdit={() => {
            setEditingTask(selectedTask);
            setShowTaskForm(true);
            setSelectedTask(null);
          }}
          onDelete={() => {
            handleDeleteTask(selectedTask.id);
            setSelectedTask(null);
          }}
          onStatusChange={(status) => {
            handleStatusChange(selectedTask.id, status);
            setSelectedTask(null);
          }}
          onSubTaskToggle={handleSubTaskToggle}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
