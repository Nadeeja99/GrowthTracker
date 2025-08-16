'use client';

import React from 'react';
import { Calendar, CheckCircle2, Clock } from 'lucide-react';
import { Goal, ScheduleActivity } from '@/types';
import { cn } from '@/lib/utils';

interface WeeklyOverviewProps {
  goals: Goal[];
  activities: ScheduleActivity[];
  isMobile: boolean;
}

export function WeeklyOverview({ goals, activities, isMobile }: WeeklyOverviewProps) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return date;
  });

  const getActivitiesForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return activities.filter(activity => activity.date === dateStr);
  };

  const getDayCompletionRate = (date: Date) => {
    const dayActivities = getActivitiesForDate(date);
    if (dayActivities.length === 0) return 0;
    const completed = dayActivities.filter(a => a.status === 'completed').length;
    return (completed / dayActivities.length) * 100;
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'bg-emerald-500';
    if (rate >= 60) return 'bg-blue-500';
    if (rate >= 40) return 'bg-yellow-500';
    if (rate > 0) return 'bg-orange-500';
    return 'bg-gray-300 dark:bg-gray-600';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
            Weekly Overview
          </h2>
        </div>
        <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
          Week of {startOfWeek.toLocaleDateString()}
        </div>
      </div>

      <div className={cn(
        'grid gap-2 md:gap-3',
        isMobile ? 'grid-cols-7' : 'grid-cols-7'
      )}>
        {weekDays.map((date, index) => {
          const isToday = date.toDateString() === today.toDateString();
          const dayActivities = getActivitiesForDate(date);
          const completionRate = getDayCompletionRate(date);
          const completedCount = dayActivities.filter(a => a.status === 'completed').length;

          return (
            <div
              key={index}
              className={cn(
                'rounded-lg border transition-all duration-200',
                isMobile ? 'p-2' : 'p-4',
                isToday
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                  : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <div className="text-center">
                <div className={cn(
                  'font-medium mb-1',
                  isMobile ? 'text-xs' : 'text-xs',
                  isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                )}>
                  {date.toLocaleDateString('en', { weekday: isMobile ? 'narrow' : 'short' })}
                </div>
                <div className={cn(
                  'font-bold mb-2',
                  isMobile ? 'text-sm' : 'text-lg',
                  isToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
                )}>
                  {date.getDate()}
                </div>

                {/* Completion indicator */}
                <div className={cn(
                  'w-full rounded-full mb-2',
                  isMobile ? 'h-1' : 'h-2',
                  getCompletionColor(completionRate)
                )}
                     style={{ opacity: completionRate > 0 ? 1 : 0.3 }}>
                </div>

                {/* Activity stats */}
                <div className={cn('space-y-1', isMobile ? 'text-xs' : 'text-xs')}>
                  {dayActivities.length > 0 ? (
                    <>
                      <div className="flex items-center justify-center space-x-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className={cn(isMobile ? 'w-2 h-2' : 'w-3 h-3')} />
                        <span>{completedCount}</span>
                      </div>
                      <div className="flex items-center justify-center space-x-1 text-gray-500 dark:text-gray-400">
                        <Clock className={cn(isMobile ? 'w-2 h-2' : 'w-3 h-3')} />
                        <span>{dayActivities.length}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-400 dark:text-gray-500">
                      {isMobile ? '—' : 'No plans'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Week summary */}
      <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className={cn(
          'grid gap-3 md:gap-4',
          isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'
        )}>
          <div className="text-center">
            <div className={cn(
              'font-bold text-emerald-600 dark:text-emerald-400',
              isMobile ? 'text-lg' : 'text-2xl'
            )}>
              {activities.filter(a => a.status === 'completed').length}
            </div>
            <div className={cn(
              'text-gray-500 dark:text-gray-400',
              isMobile ? 'text-xs' : 'text-sm'
            )}>Completed</div>
          </div>
          <div className="text-center">
            <div className={cn(
              'font-bold text-blue-600 dark:text-blue-400',
              isMobile ? 'text-lg' : 'text-2xl'
            )}>
              {activities.length}
            </div>
            <div className={cn(
              'text-gray-500 dark:text-gray-400',
              isMobile ? 'text-xs' : 'text-sm'
            )}>Total</div>
          </div>
          {!isMobile && (
            <>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {Math.round((activities.filter(a => a.status === 'completed').length / Math.max(activities.length, 1)) * 100)}%
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Success Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {goals.reduce((sum, goal) => sum + goal.streakDays, 0)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Streaks</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}