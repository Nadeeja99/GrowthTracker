'use client';

import React from 'react';
import { Calendar, CheckCircle2, Clock } from 'lucide-react';
import { Goal, ScheduleActivity } from '@/types';
import { cn } from '@/lib/utils';
import { toDateKey } from '@/lib/dates';

interface WeeklyOverviewProps {
  goals: Goal[];
  activities: ScheduleActivity[];
  isMobile: boolean;
}

export function WeeklyOverview({ activities, isMobile }: WeeklyOverviewProps) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return date;
  });

  const getActivitiesForDate = (date: Date) => {
    const dateStr = toDateKey(date);
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

  const weekActivities = weekDays.flatMap(getActivitiesForDate);
  const weekCompleted = weekActivities.filter(a => a.status === 'completed').length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">
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
                  : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
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

      {/* Week summary (this week's blocks only) */}
      <dl className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Completed', value: weekCompleted },
          { label: 'Planned', value: weekActivities.length },
          { label: 'Completion', value: `${Math.round((weekCompleted / Math.max(weekActivities.length, 1)) * 100)}%` },
        ].map(stat => (
          <div key={stat.label}>
            <dd className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{stat.value}</dd>
            <dt className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}