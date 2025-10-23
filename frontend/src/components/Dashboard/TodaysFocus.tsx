'use client';

import React, { useState } from 'react';
import { CheckCircle2, Circle, Clock, Play, Pause, RotateCcw, MoreVertical } from 'lucide-react';
import { ScheduleActivity, Goal } from '@/types';
import { useTimer } from '@/hooks/useTimer';
import { formatTime, getTimeStatus } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { SwipeableCard } from '@/components/ui/SwipeableCard';

interface TodaysFocusProps {
  activities: ScheduleActivity[];
  goals: Goal[];
  onActivityStatusChange: (activityId: string, status: ScheduleActivity['status']) => void;
  isMobile: boolean;
}

export function TodaysFocus({ activities, goals, onActivityStatusChange, isMobile }: TodaysFocusProps) {
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const timer = useTimer();

  const today = new Date().toISOString().split('T')[0];
  const todaysActivities = activities.filter(activity => activity.date === today);

  const getGoalById = (goalId: string) => goals.find(g => g.id === goalId);

  const getStatusColor = (status: ScheduleActivity['status']) => {
    switch (status) {
      case 'completed': return 'text-emerald-500';
      case 'in-progress': return 'text-blue-500';
      case 'skipped': return 'text-red-500';
      case 'rescheduled': return 'text-yellow-500';
      default: return 'text-gray-400';
    }
  };

  const handleSwipeComplete = (activityId: string) => {
    onActivityStatusChange(activityId, 'completed');
  };

  const handleSwipeSkip = (activityId: string) => {
    onActivityStatusChange(activityId, 'skipped');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center space-x-3">
          <Clock className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
            Today's Focus
          </h2>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {todaysActivities.filter(a => a.status === 'completed').length} / {todaysActivities.length} completed
        </div>
      </div>

      {/* Timer Section */}
      {selectedActivity && (
        <div className="mb-4 md:mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">Active Timer</h3>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                {todaysActivities.find(a => a.id === selectedActivity)?.title}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400">
                {timer.formatTime()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {timer.currentSession} session
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 mb-3">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${timer.progress * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round(timer.progress * 100)}%
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={timer.isRunning ? timer.pauseTimer : timer.startTimer}
              className="flex items-center space-x-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              {timer.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{timer.isRunning ? 'Pause' : 'Start'}</span>
            </button>
            <button
              onClick={timer.skipSession}
              className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
            >
              Skip
            </button>
            <button
              onClick={timer.resetTimer}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Activities List */}
      <div className="space-y-2 md:space-y-3">
        {todaysActivities.map((activity) => {
          const goal = getGoalById(activity.goalId);
          const timeStatus = getTimeStatus(activity.startTime, activity.endTime);
          
          const ActivityCard = (
            <div className={cn(
              'p-3 md:p-4 rounded-lg border transition-all duration-200',
              timeStatus === 'current' 
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' 
                : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <button
                  onClick={() => onActivityStatusChange(
                    activity.id, 
                    activity.status === 'completed' ? 'pending' : 'completed'
                  )}
                  className={`${getStatusColor(activity.status)} hover:opacity-70 transition-opacity flex-shrink-0`}
                >
                  {activity.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
                  ) : (
                    <Circle className="w-5 h-5 md:w-6 md:h-6" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className={cn(
                      'font-semibold truncate',
                      activity.status === 'completed' 
                        ? 'line-through text-gray-500 dark:text-gray-400' 
                        : 'text-gray-900 dark:text-white',
                      isMobile ? 'text-sm' : 'text-base'
                    )}>
                      {activity.title}
                    </h3>
                    {goal && (
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: goal.color }}
                      />
                    )}
                  </div>
                  <div className="flex items-center space-x-2 md:space-x-4 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                    <span>{formatTime(activity.startTime)} - {formatTime(activity.endTime)}</span>
                    {goal && <span className="truncate">{goal.name}</span>}
                    {timeStatus === 'current' && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs font-medium flex-shrink-0">
                        NOW
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                {activity.status !== 'completed' && (
                  <button
                    onClick={() => setSelectedActivity(selectedActivity === activity.id ? null : activity.id)}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      selectedActivity === activity.id
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}

                {!isMobile && (
                  <select
                    value={activity.status}
                    onChange={(e) => onActivityStatusChange(activity.id, e.target.value as ScheduleActivity['status'])}
                    className="text-xs md:text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="skipped">Skipped</option>
                    <option value="rescheduled">Rescheduled</option>
                  </select>
                )}

                {isMobile && (
                  <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          );

          if (isMobile && activity.status !== 'completed') {
            return (
              <SwipeableCard
                key={activity.id}
                onSwipeRight={() => handleSwipeComplete(activity.id)}
                onSwipeLeft={() => handleSwipeSkip(activity.id)}
                rightAction={{
                  icon: <CheckCircle2 className="w-5 h-5" />,
                  color: 'bg-emerald-500',
                  label: 'Complete'
                }}
                leftAction={{
                  icon: <Circle className="w-5 h-5" />,
                  color: 'bg-red-500',
                  label: 'Skip'
                }}
              >
                {ActivityCard}
              </SwipeableCard>
            );
          }

          return <div key={activity.id}>{ActivityCard}</div>;
        })}
      </div>

      {todaysActivities.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm md:text-base">No activities scheduled for today</p>
          <p className="text-xs md:text-sm">Plan your day to start tracking progress</p>
        </div>
      )}
    </div>
  );
}