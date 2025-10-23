'use client';

import React from 'react';
import { Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Goal } from '@/types';
import { cn } from '@/lib/utils';

interface GoalProgressChartProps {
  goals: Goal[];
  timeRange: string;
  selectedGoal: string;
  isMobile: boolean;
}

export function GoalProgressChart({
  goals,
  timeRange,
  selectedGoal,
  isMobile
}: GoalProgressChartProps) {
  const filteredGoals = selectedGoal === 'all' ? goals : goals.filter(g => g.id === selectedGoal);

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-emerald-500';
    if (progress >= 80) return 'bg-blue-500';
    if (progress >= 60) return 'bg-yellow-500';
    if (progress >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getProgressStatus = (progress: number) => {
    if (progress >= 100) return 'Completed';
    if (progress >= 80) return 'On Track';
    if (progress >= 60) return 'Good Progress';
    if (progress >= 40) return 'Needs Attention';
    return 'Behind Schedule';
  };

  const getProgressIcon = (progress: number) => {
    if (progress >= 100) return <Target className="w-4 h-4 text-emerald-600" />;
    if (progress >= 80) return <TrendingUp className="w-4 h-4 text-blue-600" />;
    if (progress >= 60) return <TrendingUp className="w-4 h-4 text-yellow-600" />;
    if (progress >= 40) return <Minus className="w-4 h-4 text-orange-600" />;
    return <TrendingDown className="w-4 h-4 text-red-600" />;
  };

  const getProgressTextColor = (progress: number) => {
    if (progress >= 100) return 'text-emerald-600 dark:text-emerald-400';
    if (progress >= 80) return 'text-blue-600 dark:text-blue-400';
    if (progress >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (progress >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const sortedGoals = [...filteredGoals].sort((a, b) => {
    const progressA = (a.currentWeeklyHours / a.targetHoursWeekly) * 100;
    const progressB = (b.currentWeeklyHours / b.targetHoursWeekly) * 100;
    return progressB - progressA;
  });

  if (filteredGoals.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No goals found
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          {selectedGoal === 'all' ? 'Create some goals to start tracking progress' : 'No goals match the selected criteria'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
            Goal Progress Overview
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Progress for {timeRange} period
          </p>
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">100%+</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">80-99%</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">60-79%</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">40-59%</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">&lt;40%</span>
          </div>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="space-y-4">
        {sortedGoals.map((goal) => {
          const progress = (goal.currentWeeklyHours / goal.targetHoursWeekly) * 100;
          const progressColor = getProgressColor(progress);
          const progressStatus = getProgressStatus(progress);
          const progressIcon = getProgressIcon(progress);
          const progressTextColor = getProgressTextColor(progress);

          return (
            <div key={goal.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: goal.color }}
                  />
                  <div>
                    <h5 className="font-semibold text-gray-900 dark:text-white">
                      {goal.name}
                    </h5>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {goal.currentWeeklyHours.toFixed(1)}h / {goal.targetHoursWeekly}h
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {progressIcon}
                    <span className={cn("text-sm font-medium", progressTextColor)}>
                      {progressStatus}
                    </span>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {progress.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {goal.streakDays} day streak
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-500 rounded-full", progressColor)}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Weekly Target
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {goal.targetHoursWeekly}h
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Current
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {goal.currentWeeklyHours.toFixed(1)}h
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Remaining
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {Math.max(0, goal.targetHoursWeekly - goal.currentWeeklyHours).toFixed(1)}h
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="bg-white dark:bg-gray-600 rounded-lg p-4 border border-gray-200 dark:border-gray-500">
        <h5 className="font-semibold text-gray-900 dark:text-white mb-3">Summary</h5>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {filteredGoals.filter(g => (g.currentWeeklyHours / g.targetHoursWeekly) * 100 >= 100).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {filteredGoals.filter(g => {
                const progress = (g.currentWeeklyHours / g.targetHoursWeekly) * 100;
                return progress >= 80 && progress < 100;
              }).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">On Track</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {filteredGoals.filter(g => {
                const progress = (g.currentWeeklyHours / g.targetHoursWeekly) * 100;
                return progress >= 60 && progress < 80;
              }).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Good Progress</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {filteredGoals.filter(g => (g.currentWeeklyHours / g.targetHoursWeekly) * 100 < 60).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Needs Attention</div>
          </div>
        </div>
      </div>
    </div>
  );
}
