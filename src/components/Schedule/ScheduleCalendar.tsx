'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, CheckCircle2, XCircle, Play, SkipForward } from 'lucide-react';
import { Goal, ScheduleActivity } from '@/types';
import { cn } from '@/lib/utils';

interface ScheduleCalendarProps {
  goals: Goal[];
  activities: ScheduleActivity[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onActivityClick: (activity: ScheduleActivity) => void;
  onActivityStatusChange: (activityId: string, status: ScheduleActivity['status']) => void;
  isMobile: boolean;
}

export function ScheduleCalendar({
  goals,
  activities,
  selectedDate,
  onDateSelect,
  onActivityClick,
  onActivityStatusChange,
  isMobile
}: ScheduleCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date(selectedDate));

  const getWeekDates = (date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDates.push(day);
    }
    return weekDates;
  };

  const getActivitiesForDate = (date: string) => {
    return activities.filter(activity => activity.date === date);
  };

  const getGoalColor = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    return goal?.color || '#6B7280';
  };

  const getStatusIcon = (status: ScheduleActivity['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'in-progress':
        return <Play className="w-4 h-4 text-blue-500" />;
      case 'skipped':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'rescheduled':
        return <SkipForward className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ScheduleActivity['status']) => {
    switch (status) {
      case 'completed':
        return 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700';
      case 'in-progress':
        return 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700';
      case 'skipped':
        return 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700';
      case 'rescheduled':
        return 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700';
      default:
        return 'border-gray-200 bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600';
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const weekDates = getWeekDates(currentWeek);
  const isToday = (date: Date) => date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
  const isSelected = (date: Date) => date.toISOString().split('T')[0] === selectedDate;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
            Weekly Schedule
          </h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          
          <button
            onClick={() => navigateWeek('next')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2 md:gap-3">
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
          <div key={day} className="text-center">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              {day}
            </div>
          </div>
        ))}

        {/* Day Cells */}
        {weekDates.map((date, index) => {
          const dateStr = date.toISOString().split('T')[0];
          const dayActivities = getActivitiesForDate(dateStr);
          const completedCount = dayActivities.filter(a => a.status === 'completed').length;
          const totalCount = dayActivities.length;
          
          return (
            <div
              key={index}
              className={cn(
                'min-h-[120px] md:min-h-[140px] p-2 md:p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-md',
                isToday(date) && 'ring-2 ring-blue-500 ring-opacity-50',
                isSelected(date) && 'ring-2 ring-purple-500 ring-opacity-50',
                'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
              onClick={() => onDateSelect(dateStr)}
            >
              {/* Date Header */}
              <div className="text-center mb-2">
                <div className={cn(
                  'font-bold text-lg',
                  isToday(date) 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-900 dark:text-white'
                )}>
                  {date.getDate()}
                </div>
                {isToday(date) && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Today
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {totalCount > 0 && (
                <div className="mb-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${(completedCount / totalCount) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
                    {completedCount}/{totalCount}
                  </div>
                </div>
              )}

              {/* Activities */}
              <div className="space-y-1">
                {dayActivities.slice(0, 2).map((activity) => (
                  <div
                    key={activity.id}
                    className={cn(
                      'p-2 rounded text-xs border cursor-pointer transition-all duration-200 hover:scale-105',
                      getStatusColor(activity.status)
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onActivityClick(activity);
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getGoalColor(activity.goalId) }}
                      />
                      {getStatusIcon(activity.status)}
                    </div>
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {activity.title}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">
                      {activity.startTime} - {activity.endTime}
                    </div>
                  </div>
                ))}
                
                {dayActivities.length > 2 && (
                  <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                    +{dayActivities.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-gray-600 dark:text-gray-400">Completed</span>
          </div>
          <div className="flex items-center space-x-2">
            <Play className="w-4 h-4 text-blue-500" />
            <span className="text-gray-600 dark:text-gray-400">In Progress</span>
          </div>
          <div className="flex items-center space-x-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-gray-600 dark:text-gray-400">Skipped</span>
          </div>
          <div className="flex items-center space-x-2">
            <SkipForward className="w-4 h-4 text-yellow-500" />
            <span className="text-gray-600 dark:text-gray-400">Rescheduled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
