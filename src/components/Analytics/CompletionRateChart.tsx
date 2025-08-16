'use client';

import React, { useMemo } from 'react';
import { Award, CheckCircle, Clock, Target, TrendingUp } from 'lucide-react';
import { Task, Goal } from '@/types';
import { cn } from '@/lib/utils';

interface CompletionRateChartProps {
  tasks: Task[];
  goals: Goal[];
  timeRange: string;
  isMobile: boolean;
}

export function CompletionRateChart({
  tasks,
  goals,
  timeRange,
  isMobile
}: CompletionRateChartProps) {
  const completionData = useMemo(() => {
    if (tasks.length === 0) return null;

    // Calculate completion rates by goal
    const goalCompletion = goals.map(goal => {
      const goalTasks = tasks.filter(task => task.goalId === goal.id);
      const completedTasks = goalTasks.filter(task => task.status === 'completed');
      const completionRate = goalTasks.length > 0 ? (completedTasks.length / goalTasks.length) * 100 : 0;
      
      return {
        goal,
        totalTasks: goalTasks.length,
        completedTasks: completedTasks.length,
        completionRate,
        pendingTasks: goalTasks.filter(task => task.status === 'todo').length,
        inProgressTasks: goalTasks.filter(task => task.status === 'in-progress').length
      };
    }).filter(item => item.totalTasks > 0);

    // Calculate overall completion rate
    const totalTasks = tasks.length;
    const totalCompleted = tasks.filter(task => task.status === 'completed').length;
    const overallCompletionRate = (totalCompleted / totalTasks) * 100;

    // Calculate completion by priority
    const priorityCompletion = {
      high: {
        total: tasks.filter(task => task.priority === 'high').length,
        completed: tasks.filter(task => task.priority === 'high' && task.status === 'completed').length
      },
      medium: {
        total: tasks.filter(task => task.priority === 'medium').length,
        completed: tasks.filter(task => task.priority === 'medium' && task.status === 'completed').length
      },
      low: {
        total: tasks.filter(task => task.priority === 'low').length,
        completed: tasks.filter(task => task.priority === 'low' && task.status === 'completed').length
      }
    };

    // Calculate average completion time for completed tasks
    const completedTasksWithTime = tasks.filter(task => 
      task.status === 'completed' && task.completedAt && task.createdAt
    );
    
    const avgCompletionTime = completedTasksWithTime.length > 0 
      ? completedTasksWithTime.reduce((sum, task) => {
          const created = new Date(task.createdAt);
          const completed = new Date(task.completedAt!);
          return sum + (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / completedTasksWithTime.length
      : 0;

    return {
      goalCompletion: goalCompletion.sort((a, b) => b.completionRate - a.completionRate),
      overallCompletionRate,
      totalTasks,
      totalCompleted,
      priorityCompletion,
      avgCompletionTime
    };
  }, [tasks, goals]);

  if (!completionData || completionData.totalTasks === 0) {
    return (
      <div className="text-center py-12">
        <Award className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No task data available
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Create some tasks to see completion rate analytics
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
            Task Completion Analytics
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Success rates and completion patterns
          </p>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {completionData.overallCompletionRate.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Overall completion rate
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600 text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
            {completionData.totalCompleted}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
            {completionData.totalTasks - completionData.totalCompleted}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Remaining</div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600 text-center">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
            {completionData.totalTasks}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600 text-center">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-1">
            {completionData.avgCompletionTime.toFixed(1)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Avg. Days</div>
        </div>
      </div>

      {/* Goal Completion Rates */}
      <div>
        <h5 className="font-semibold text-gray-900 dark:text-white mb-4">
          Completion by Goal Area
        </h5>
        <div className="space-y-3">
          {completionData.goalCompletion.map((item) => (
            <div key={item.goal.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.goal.color }}
                  />
                  <div>
                    <h6 className="font-medium text-gray-900 dark:text-white">
                      {item.goal.name}
                    </h6>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {item.completedTasks} of {item.totalTasks} tasks completed
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {item.completionRate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    completion rate
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-3">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${item.completionRate}%` }}
                />
              </div>

              {/* Task Status Breakdown */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-medium text-emerald-600 dark:text-emerald-400">
                    {item.completedTasks}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">Done</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-blue-600 dark:text-blue-400">
                    {item.inProgressTasks}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">In Progress</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-gray-600 dark:text-gray-400">
                    {item.pendingTasks}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">Pending</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Priority Completion */}
      <div>
        <h5 className="font-semibold text-gray-900 dark:text-white mb-4">
          Completion by Priority
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(completionData.priorityCompletion).map(([priority, data]) => {
            if (data.total === 0) return null;
            
            const completionRate = (data.completed / data.total) * 100;
            const priorityColor: Record<string, string> = {
              high: 'text-red-600 dark:text-red-400',
              medium: 'text-yellow-600 dark:text-yellow-400',
              low: 'text-green-600 dark:text-green-400'
            };
            
            const priorityBg: Record<string, string> = {
              high: 'bg-red-100 dark:bg-red-900/20',
              medium: 'bg-yellow-100 dark:bg-yellow-900/20',
              low: 'bg-green-100 dark:bg-green-900/20'
            };

            return (
              <div key={priority} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className={cn("px-2 py-1 rounded text-xs font-medium", priorityBg[priority])}>
                      <span className={priorityColor[priority as keyof typeof priorityColor]}>
                        {priority.toUpperCase()}
                      </span>
                    </div>
                    <h6 className="font-medium text-gray-900 dark:text-white">
                      Priority
                    </h6>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {completionRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {data.completed}/{data.total}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion Insights */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
          Completion Insights
        </h5>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          {(() => {
            const highPriorityCompletion = completionData.priorityCompletion.high.total > 0 
              ? (completionData.priorityCompletion.high.completed / completionData.priorityCompletion.high.total) * 100 
              : 0;
            
            const bestPerformingGoal = completionData.goalCompletion[0];
            const needsAttentionGoal = completionData.goalCompletion.find(item => item.completionRate < 50);
            
            return (
              <>
                {completionData.overallCompletionRate >= 80 && (
                  <p>• 🎉 Excellent work! You're maintaining a high completion rate of {completionData.overallCompletionRate.toFixed(1)}%</p>
                )}
                {completionData.overallCompletionRate >= 60 && completionData.overallCompletionRate < 80 && (
                  <p>• Good progress! Focus on completing more tasks to reach your targets</p>
                )}
                {completionData.overallCompletionRate < 60 && (
                  <p>• Consider breaking down larger tasks and setting more achievable daily goals</p>
                )}
                
                {bestPerformingGoal && (
                  <p>
                    • <strong>{bestPerformingGoal.goal.name}</strong> is your best performing area with{' '}
                    {bestPerformingGoal.completionRate.toFixed(1)}% completion rate
                  </p>
                )}
                
                {needsAttentionGoal && (
                  <p>
                    • <strong>{needsAttentionGoal.goal.name}</strong> needs attention with only{' '}
                    {needsAttentionGoal.completionRate.toFixed(1)}% completion rate
                  </p>
                )}
                
                {highPriorityCompletion < 70 && completionData.priorityCompletion.high.total > 0 && (
                  <p>• Focus on completing high-priority tasks first - current rate: {highPriorityCompletion.toFixed(1)}%</p>
                )}
                
                <p>• Average task completion time: {completionData.avgCompletionTime.toFixed(1)} days</p>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
