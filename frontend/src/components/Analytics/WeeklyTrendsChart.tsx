'use client';

import React, { useMemo } from 'react';
import { TrendingUp, Calendar, Activity, CheckCircle } from 'lucide-react';
import { ScheduleActivity, Task, DailyRating } from '@/types';

interface WeeklyTrendsChartProps {
  activities: ScheduleActivity[];
  tasks: Task[];
  ratings: DailyRating[];
  timeRange: string;
  isMobile: boolean;
}

export function WeeklyTrendsChart({
  activities,
  tasks,
  ratings,
  timeRange,
  isMobile
}: WeeklyTrendsChartProps) {
  const trendsData = useMemo(() => {
    const now = new Date();
    const days = [];
    
    // Generate date range based on timeRange
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

    // Generate daily data points
    const currentDate = new Date(startDate);
    while (currentDate <= now) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Activities for this date
      const dayActivities = activities.filter(activity => 
        activity.date === dateStr && activity.status === 'completed'
      );
      
      // Calculate total hours for this date
      const totalHours = dayActivities.reduce((total, activity) => {
        const start = new Date(`2000-01-01T${activity.startTime}`);
        const end = new Date(`2000-01-01T${activity.endTime}`);
        return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }, 0);

      // Tasks completed on this date
      const completedTasks = tasks.filter(task => 
        task.completedAt && task.completedAt.startsWith(dateStr)
      ).length;

      // Daily rating for this date
      const dailyRating = ratings.find(rating => rating.date === dateStr);

      days.push({
        date: dateStr,
        dateObj: new Date(currentDate),
        totalHours,
        completedTasks,
        rating: dailyRating?.performance || 0,
        activityCount: dayActivities.length
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  }, [activities, tasks, ratings, timeRange]);

  if (trendsData.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No trend data available
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Complete some activities and tasks to see performance trends
        </p>
      </div>
    );
  }

  const maxHours = Math.max(...trendsData.map(d => d.totalHours));
  const maxTasks = Math.max(...trendsData.map(d => d.completedTasks));
  const maxRating = 5;

  const getDayLabel = (date: Date) => {
    if (timeRange === 'week') {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else if (timeRange === 'month') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
            Performance Trends
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your daily progress over time
          </p>
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Hours</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Tasks</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Rating</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <div className="h-64 flex items-end space-x-1 md:space-x-2">
          {trendsData.map((day, index) => {
            const hoursHeight = maxHours > 0 ? (day.totalHours / maxHours) * 100 : 0;
            const tasksHeight = maxTasks > 0 ? (day.completedTasks / maxTasks) * 100 : 0;
            const ratingHeight = (day.rating / maxRating) * 100;
            
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center space-y-1">
                {/* Hours Bar */}
                <div className="w-full bg-blue-500 rounded-t transition-all duration-300 hover:opacity-80 relative group">
                  <div 
                    className="bg-blue-500 rounded-t transition-all duration-500"
                    style={{ height: `${hoursHeight}%` }}
                  />
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {day.totalHours.toFixed(1)}h
                  </div>
                </div>

                {/* Tasks Bar */}
                <div className="w-full bg-emerald-500 rounded-t transition-all duration-300 hover:opacity-80 relative group">
                  <div 
                    className="bg-emerald-500 rounded-t transition-all duration-500"
                    style={{ height: `${tasksHeight}%` }}
                  />
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {day.completedTasks} tasks
                  </div>
                </div>

                {/* Rating Bar */}
                <div className="w-full bg-purple-500 rounded-t transition-all duration-300 hover:opacity-80 relative group">
                  <div 
                    className="bg-purple-500 rounded-t transition-all duration-500"
                    style={{ height: `${ratingHeight}%` }}
                  />
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {day.rating}/5 rating
                  </div>
                </div>

                {/* Date Label */}
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                  {getDayLabel(day.dateObj)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{maxHours.toFixed(1)}h</span>
          <span>{(maxHours / 2).toFixed(1)}h</span>
          <span>0h</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3 mb-2">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h5 className="font-medium text-gray-900 dark:text-white">Total Hours</h5>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {trendsData.reduce((sum, day) => sum + day.totalHours, 0).toFixed(1)}h
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {timeRange} period
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3 mb-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h5 className="font-medium text-gray-900 dark:text-white">Total Tasks</h5>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {trendsData.reduce((sum, day) => sum + day.completedTasks, 0)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            completed
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3 mb-2">
            <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h5 className="font-medium text-gray-900 dark:text-white">Avg. Rating</h5>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {(trendsData.reduce((sum, day) => sum + day.rating, 0) / trendsData.filter(d => d.rating > 0).length || 0).toFixed(1)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            out of 5
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3 mb-2">
            <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h5 className="font-medium text-gray-900 dark:text-white">Active Days</h5>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {trendsData.filter(day => day.totalHours > 0 || day.completedTasks > 0).length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            of {trendsData.length} days
          </div>
        </div>
      </div>

      {/* Trend Insights */}
      {trendsData.length > 1 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            Trend Analysis
          </h5>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            {(() => {
              const activeDays = trendsData.filter(day => day.totalHours > 0 || day.completedTasks > 0).length;
              const totalDays = trendsData.length;
              const consistencyRate = (activeDays / totalDays) * 100;
              
              const avgHours = trendsData.reduce((sum, day) => sum + day.totalHours, 0) / totalDays;
              const avgTasks = trendsData.reduce((sum, day) => sum + day.completedTasks, 0) / totalDays;
              
              return (
                <>
                  <p>
                    • <strong>{consistencyRate.toFixed(0)}%</strong> of days have activity ({activeDays}/{totalDays} days)
                  </p>
                  <p>
                    • Average daily output: <strong>{avgHours.toFixed(1)}h</strong> and <strong>{avgTasks.toFixed(1)}</strong> tasks
                  </p>
                  {consistencyRate >= 80 && (
                    <p>• Excellent consistency! You're maintaining steady progress.</p>
                  )}
                  {consistencyRate >= 60 && consistencyRate < 80 && (
                    <p>• Good consistency! Consider adding more daily activities.</p>
                  )}
                  {consistencyRate < 60 && (
                    <p>• Focus on building daily habits for better consistency.</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
