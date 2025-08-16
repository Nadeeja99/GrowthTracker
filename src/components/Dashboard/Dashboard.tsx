'use client';

import React from 'react';
import { WeeklyOverview } from './WeeklyOverview';
import { GoalProgress } from './GoalProgress';
import { TodaysFocus } from './TodaysFocus';
import { QuickStats } from './QuickStats';
import { Goal, ScheduleActivity, Achievement } from '@/types';
import { cn } from '@/lib/utils';

interface DashboardProps {
  goals: Goal[];
  activities: ScheduleActivity[];
  achievements: Achievement[];
  onGoalClick: (goalId: string) => void;
  onActivityStatusChange: (activityId: string, status: ScheduleActivity['status']) => void;
  onViewChange: (view: string) => void;
  isMobile: boolean;
}

export function Dashboard({
  goals,
  activities,
  achievements,
  onGoalClick,
  onActivityStatusChange,
  onViewChange,
  isMobile
}: DashboardProps) {
  return (
    <div className={cn('space-y-4 md:space-y-6', isMobile && 'pb-20')}>
      {/* Quick Stats Row */}
      <QuickStats 
        goals={goals} 
        activities={activities} 
        achievements={achievements}
        onViewChange={onViewChange}
        isMobile={isMobile}
      />

      {/* Main Content Grid */}
      <div className={cn(
        'grid gap-4 md:gap-6',
        isMobile 
          ? 'grid-cols-1' 
          : 'grid-cols-1 xl:grid-cols-3'
      )}>
        {/* Weekly Overview */}
        <div className={cn(isMobile ? 'order-2' : 'xl:col-span-2')}>
          <WeeklyOverview 
            goals={goals} 
            activities={activities} 
            isMobile={isMobile}
          />
        </div>

        {/* Today's Focus */}
        <div className={cn(isMobile ? 'order-1' : '')}>
          <TodaysFocus 
            activities={activities}
            goals={goals}
            onActivityStatusChange={onActivityStatusChange}
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* Goal Progress */}
      <div className="grid grid-cols-1">
        <GoalProgress 
          goals={goals} 
          onGoalClick={onGoalClick} 
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}