'use client';

import React from 'react';
import { Target, CheckCircle2, Flame, Award, TrendingUp, Clock } from 'lucide-react';
import { Goal, ScheduleActivity, Achievement } from '@/types';
import { cn } from '@/lib/utils';

interface QuickStatsProps {
  goals: Goal[];
  activities: ScheduleActivity[];
  achievements: Achievement[];
  onViewChange: (view: string) => void;
  isMobile: boolean;
}

export function QuickStats({ goals, activities, achievements, onViewChange, isMobile }: QuickStatsProps) {
  const today = new Date().toISOString().split('T')[0];
  const todaysActivities = activities.filter(a => a.date === today);
  const completedToday = todaysActivities.filter(a => a.status === 'completed').length;
  const totalStreaks = goals.reduce((sum, goal) => sum + goal.streakDays, 0);
  const unlockedAchievements = achievements.filter(a => a.unlockedAt).length;
  const totalWeeklyHours = goals.reduce((sum, goal) => sum + goal.currentWeeklyHours, 0);
  const targetWeeklyHours = goals.reduce((sum, goal) => sum + goal.targetHoursWeekly, 0);
  const overallProgress = targetWeeklyHours > 0 ? (totalWeeklyHours / targetWeeklyHours) * 100 : 0;

  const stats = [
    {
      id: 'completed-today',
      label: 'Completed Today',
      value: completedToday.toString(),
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      onClick: () => onViewChange('schedule')
    },
    {
      id: 'total-streaks',
      label: 'Total Streaks',
      value: totalStreaks.toString(),
      icon: Flame,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      onClick: () => onViewChange('goals')
    },
    {
      id: 'achievements',
      label: 'Achievements',
      value: unlockedAchievements.toString(),
      icon: Award,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      onClick: () => onViewChange('analytics')
    },
    {
      id: 'weekly-progress',
      label: 'Weekly Progress',
      value: `${Math.round(overallProgress)}%`,
      icon: TrendingUp,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      onClick: () => onViewChange('analytics')
    },
    {
      id: 'active-goals',
      label: 'Active Goals',
      value: goals.length.toString(),
      icon: Target,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      onClick: () => onViewChange('goals')
    },
    {
      id: 'total-hours',
      label: 'This Week',
      value: `${totalWeeklyHours.toFixed(1)}h`,
      icon: Clock,
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-900/20',
      onClick: () => onViewChange('analytics')
    }
  ];

  return (
    <div className={cn(
      'grid gap-3 md:gap-4',
      isMobile 
        ? 'grid-cols-2' 
        : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
    )}>
      {stats.map((stat) => (
        <div
          key={stat.id}
          onClick={stat.onClick}
          className={cn(
            'rounded-xl p-3 md:p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 border border-gray-100 dark:border-gray-700 active:scale-95',
            stat.bgColor
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <stat.icon className={cn('transition-all', stat.color, isMobile ? 'w-4 h-4' : 'w-5 h-5')} />
            <div className={cn(
              'font-bold text-gray-900 dark:text-white',
              isMobile ? 'text-lg' : 'text-2xl'
            )}>
              {stat.value}
            </div>
          </div>
          <div className={cn(
            'font-medium text-gray-600 dark:text-gray-300',
            isMobile ? 'text-xs' : 'text-sm'
          )}>
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}