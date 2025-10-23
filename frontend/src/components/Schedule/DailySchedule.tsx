'use client';

import React, { useState } from 'react';
import { Calendar, Clock, Plus, CheckCircle2, XCircle, Play, SkipForward, Edit, Trash2 } from 'lucide-react';
import { Goal, ScheduleActivity } from '@/types';
import { cn } from '@/lib/utils';

interface DailyScheduleProps {
  goals: Goal[];
  activities: ScheduleActivity[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onActivityClick: (activity: ScheduleActivity) => void;
  onActivityStatusChange: (activityId: string, status: ScheduleActivity['status']) => void;
  onCreateActivity: () => void;
  isMobile: boolean;
}

export function DailySchedule({
  goals,
  activities,
  selectedDate,
  onDateSelect,
  onActivityClick,
  onActivityStatusChange,
  onCreateActivity,
  isMobile
}: DailyScheduleProps) {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  const getActivitiesForDate = (date: string) => {
    return activities.filter(activity => activity.date === date);
  };

  const getGoalColor = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    return goal?.color || '#6B7280';
  };

  const getGoalName = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    return goal?.name || 'Unknown Goal';
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

  const getStatusText = (status: ScheduleActivity['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in-progress':
        return 'In Progress';
      case 'skipped':
        return 'Skipped';
      case 'rescheduled':
        return 'Rescheduled';
      default:
        return 'Pending';
    }
  };

  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  const dayActivities = getActivitiesForDate(selectedDate);
  const selectedDateObj = new Date(selectedDate);
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  const getActivitiesForTimeSlot = (timeSlot: string) => {
    const hour = parseInt(timeSlot.split(':')[0]);
    return dayActivities.filter(activity => {
      const startHour = parseInt(activity.startTime.split(':')[0]);
      const endHour = parseInt(activity.endTime.split(':')[0]);
      return hour >= startHour && hour < endHour;
    });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDateObj.getDate() + (direction === 'next' ? 1 : -1));
    onDateSelect(newDate.toISOString().split('T')[0]);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
            Daily Schedule
          </h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Calendar className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {selectedDateObj.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
            {isToday && (
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                Today
              </div>
            )}
          </div>
          
          <button
            onClick={() => navigateDate('next')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Calendar className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {dayActivities.filter(a => a.status === 'completed').length}
          </div>
          <div className="text-sm text-emerald-600 dark:text-emerald-400">Completed</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {dayActivities.filter(a => a.status === 'in-progress').length}
          </div>
          <div className="text-sm text-blue-600 dark:text-blue-400">In Progress</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {dayActivities.filter(a => a.status === 'pending').length}
          </div>
          <div className="text-sm text-yellow-600 dark:text-yellow-400">Pending</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {dayActivities.filter(a => a.status === 'skipped').length}
          </div>
          <div className="text-sm text-red-600 dark:text-red-400">Skipped</div>
        </div>
      </div>

      {/* Time Slots */}
      <div className="space-y-2">
        {timeSlots.map((timeSlot) => {
          const slotActivities = getActivitiesForTimeSlot(timeSlot);
          const isSelected = selectedTimeSlot === timeSlot;
          
          return (
            <div
              key={timeSlot}
              className={cn(
                'flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200',
                isSelected 
                  ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              )}
              onClick={() => setSelectedTimeSlot(isSelected ? null : timeSlot)}
            >
              {/* Time Label */}
              <div className="w-16 flex-shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400">
                {timeSlot}
              </div>

              {/* Activities */}
              <div className="flex-1 space-y-2">
                {slotActivities.length > 0 ? (
                  slotActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md',
                        getStatusColor(activity.status)
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onActivityClick(activity);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: getGoalColor(activity.goalId) }}
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {getGoalName(activity.goalId)}
                            </span>
                            {getStatusIcon(activity.status)}
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                            {activity.title}
                          </h3>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {activity.startTime} - {activity.endTime}
                          </div>
                          {activity.notes && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                              {activity.notes}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-3">
                          <span className={cn(
                            'px-2 py-1 rounded text-xs font-medium',
                            activity.status === 'completed' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
                            activity.status === 'in-progress' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                            activity.status === 'skipped' && 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
                            activity.status === 'rescheduled' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
                            activity.status === 'pending' && 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300'
                          )}>
                            {getStatusText(activity.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 dark:text-gray-500 text-sm italic">
                    No activities scheduled
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Activity Button */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onCreateActivity}
          className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center justify-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add Activity to {selectedDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </button>
      </div>
    </div>
  );
}
