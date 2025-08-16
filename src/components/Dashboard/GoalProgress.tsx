'use client';

import React from 'react';
import { Target, TrendingUp, Flame, Clock } from 'lucide-react';
import { Goal } from '@/types';
import { getProgressPercentage, getProgressColor, getStreakColor, getCategoryBadgeColor } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface GoalProgressProps {
  goals: Goal[];
  onGoalClick: (goalId: string) => void;
  isMobile: boolean;
}

export function GoalProgress({ goals, onGoalClick, isMobile }: GoalProgressProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
      <div className="flex items-center space-x-3 mb-4 md:mb-6">
        <Target className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
          Goal Progress
        </h2>
      </div>

      <div className="space-y-3 md:space-y-4">
        {goals.map((goal) => {
          const progressPercentage = getProgressPercentage(goal.currentWeeklyHours, goal.targetHoursWeekly);
          
          return (
            <div
              key={goal.id}
              onClick={() => onGoalClick(goal.id)}
              className="p-3 md:p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 cursor-pointer transition-all duration-200 hover:shadow-md active:scale-95"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: goal.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className={cn(
                      'font-semibold text-gray-900 dark:text-white truncate',
                      isMobile ? 'text-sm' : 'text-base'
                    )}>
                      {goal.name}
                    </h3>
                    <p className={cn(
                      'text-gray-500 dark:text-gray-400',
                      isMobile ? 'text-xs' : 'text-sm'
                    )}>
                      {goal.currentWeeklyHours.toFixed(1)}h / {goal.targetHoursWeekly}h this week
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                  <div className="flex items-center space-x-1">
                    <Flame className={cn('w-4 h-4', getStreakColor(goal.streakDays))} />
                    <span className={cn(
                      'font-medium',
                      getStreakColor(goal.streakDays),
                      isMobile ? 'text-xs' : 'text-sm'
                    )}>
                      {goal.streakDays}
                    </span>
                  </div>
                  <div className={cn(
                    'px-2 py-1 rounded font-medium',
                    getCategoryBadgeColor(goal.category),
                    isMobile ? 'text-xs' : 'text-xs'
                  )}>
                    {goal.category.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-2">
                  <span className={cn(
                    'font-medium text-gray-700 dark:text-gray-300',
                    isMobile ? 'text-xs' : 'text-sm'
                  )}>
                    Weekly Progress
                  </span>
                  <span className={cn(
                    'font-bold text-gray-900 dark:text-white',
                    isMobile ? 'text-xs' : 'text-sm'
                  )}>
                    {progressPercentage.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 md:h-3 overflow-hidden">
                  <div
                    className={cn('h-full transition-all duration-500', getProgressColor(progressPercentage))}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              {/* Additional stats */}
              <div className={cn(
                'flex items-center justify-between',
                isMobile ? 'text-xs' : 'text-sm'
              )}>
                <div className="flex items-center space-x-2 md:space-x-4">
                  <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                    <Clock className="w-3 h-3 md:w-4 md:h-4" />
                    <span>{goal.targetHoursDaily}h/day target</span>
                  </div>
                  {!isMobile && (
                    <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                      <TrendingUp className="w-4 h-4" />
                      <span>
                        {goal.currentWeeklyHours >= goal.targetHoursWeekly * 0.8 ? 'On track' : 
                         goal.currentWeeklyHours >= goal.targetHoursWeekly * 0.5 ? 'Behind' : 'Needs attention'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {goals.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className={isMobile ? 'text-sm' : 'text-base'}>No goals created yet</p>
          <p className={isMobile ? 'text-xs' : 'text-sm'}>Start by creating your first development goal</p>
        </div>
      )}
    </div>
  );
}