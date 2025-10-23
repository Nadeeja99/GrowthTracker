'use client';

import React, { useMemo } from 'react';
import { Activity, Flame, Target, Calendar } from 'lucide-react';
import { ScheduleActivity, Goal } from '@/types';
import { cn } from '@/lib/utils';

interface HabitStrengthChartProps {
  activities: ScheduleActivity[];
  goals: Goal[];
  timeRange: string;
  isMobile: boolean;
}

export function HabitStrengthChart({
  activities,
  goals,
  timeRange,
  isMobile
}: HabitStrengthChartProps) {
  const habitData = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    
    switch (timeRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'quarter':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'year':
        startDate.setDate(now.getDate() - 365);
        break;
    }

    // Calculate habit strength for each goal
    const goalHabits = goals.map(goal => {
      const goalActivities = activities.filter(activity => 
        activity.goalId === goal.id && 
        activity.status === 'completed' &&
        new Date(activity.date) >= startDate && 
        new Date(activity.date) <= now
      );

      // Group activities by date
      const activitiesByDate = new Map<string, number>();
      goalActivities.forEach(activity => {
        const date = activity.date;
        const existing = activitiesByDate.get(date) || 0;
        activitiesByDate.set(date, existing + 1);
      });

      // Calculate consistency metrics
      const totalDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const activeDays = activitiesByDate.size;
      const consistencyRate = (activeDays / totalDays) * 100;

      // Calculate streak
      let currentStreak = 0;
      let maxStreak = 0;
      let tempStreak = 0;
      
      const currentDate = new Date(startDate);
      while (currentDate <= now) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const hasActivity = activitiesByDate.has(dateStr);
        
        if (hasActivity) {
          tempStreak++;
          maxStreak = Math.max(maxStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Current streak is the last consecutive days
      currentStreak = tempStreak;

      // Calculate average daily activities
      const totalActivities = goalActivities.length;
      const avgDailyActivities = activeDays > 0 ? totalActivities / activeDays : 0;

      // Determine habit strength level
      let strengthLevel = 'weak';
      let strengthColor = 'text-red-600 dark:text-red-400';
      let strengthBg = 'bg-red-100 dark:bg-red-900/20';
      
      if (consistencyRate >= 80 && currentStreak >= 7) {
        strengthLevel = 'excellent';
        strengthColor = 'text-emerald-600 dark:text-emerald-400';
        strengthBg = 'bg-emerald-100 dark:bg-emerald-900/20';
      } else if (consistencyRate >= 60 && currentStreak >= 5) {
        strengthLevel = 'strong';
        strengthColor = 'text-blue-600 dark:text-blue-400';
        strengthBg = 'bg-blue-100 dark:bg-blue-900/20';
      } else if (consistencyRate >= 40 && currentStreak >= 3) {
        strengthLevel = 'moderate';
        strengthColor = 'text-yellow-600 dark:text-yellow-400';
        strengthBg = 'bg-yellow-100 dark:bg-yellow-900/20';
      } else if (consistencyRate >= 20) {
        strengthLevel = 'developing';
        strengthColor = 'text-orange-600 dark:text-orange-400';
        strengthBg = 'bg-orange-100 dark:bg-orange-900/20';
      }

      return {
        goal,
        consistencyRate,
        activeDays,
        totalDays,
        currentStreak,
        maxStreak,
        totalActivities,
        avgDailyActivities,
        strengthLevel,
        strengthColor,
        strengthBg
      };
    });

    return goalHabits.sort((a, b) => b.consistencyRate - a.consistencyRate);
  }, [activities, goals, timeRange]);

  if (habitData.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No habit data available
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Complete some activities to see habit strength patterns
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
            Habit Strength Analysis
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Consistency patterns for each goal area
          </p>
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Excellent</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Strong</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Moderate</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Developing</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Weak</span>
          </div>
        </div>
      </div>

      {/* Habit Strength Cards */}
      <div className="space-y-4">
        {habitData.map((habit) => (
          <div key={habit.goal.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: habit.goal.color }}
                />
                <div>
                  <h5 className="font-semibold text-gray-900 dark:text-white">
                    {habit.goal.name}
                  </h5>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {habit.activeDays} active days out of {habit.totalDays}
                  </p>
                </div>
              </div>
              
              <div className={cn("px-3 py-1 rounded-full text-sm font-medium", habit.strengthBg)}>
                <span className={habit.strengthColor}>
                  {habit.strengthLevel.charAt(0).toUpperCase() + habit.strengthLevel.slice(1)}
                </span>
              </div>
            </div>

            {/* Consistency Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Consistency Rate
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {habit.consistencyRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-500 rounded-full", {
                    'bg-emerald-500': habit.strengthLevel === 'excellent',
                    'bg-blue-500': habit.strengthLevel === 'strong',
                    'bg-yellow-500': habit.strengthLevel === 'moderate',
                    'bg-orange-500': habit.strengthLevel === 'developing',
                    'bg-red-500': habit.strengthLevel === 'weak'
                  })}
                  style={{ width: `${Math.min(habit.consistencyRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Habit Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Current Streak
                  </span>
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {habit.currentStreak}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  days
                </div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <Target className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Best Streak
                  </span>
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {habit.maxStreak}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  days
                </div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <Activity className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Total Activities
                  </span>
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {habit.totalActivities}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  completed
                </div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Avg. Daily
                  </span>
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {habit.avgDailyActivities.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  activities
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Habit Insights */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
          Habit Development Insights
        </h5>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          {(() => {
            const excellentHabits = habitData.filter(h => h.strengthLevel === 'excellent').length;
            const strongHabits = habitData.filter(h => h.strengthLevel === 'strong').length;
            const totalHabits = habitData.length;
            
            return (
              <>
                <p>
                  • <strong>{excellentHabits}</strong> out of {totalHabits} goals have excellent habit strength 
                  (80%+ consistency with 7+ day streaks)
                </p>
                <p>
                  • <strong>{strongHabits}</strong> goals show strong habit formation 
                  (60%+ consistency with 5+ day streaks)
                </p>
                {excellentHabits + strongHabits >= totalHabits * 0.7 && (
                  <p>• 🎉 Excellent work! You're building strong, consistent habits across most goal areas.</p>
                )}
                {excellentHabits + strongHabits >= totalHabits * 0.5 && excellentHabits + strongHabits < totalHabits * 0.7 && (
                  <p>• Good progress! Focus on building consistency for the remaining goals.</p>
                )}
                {excellentHabits + strongHabits < totalHabits * 0.5 && (
                  <p>• Focus on building daily routines. Start with small, consistent actions.</p>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
