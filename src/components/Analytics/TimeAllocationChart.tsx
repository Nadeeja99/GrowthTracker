'use client';

import React, { useMemo } from 'react';
import { Clock, PieChart, Target } from 'lucide-react';
import { ScheduleActivity, Goal } from '@/types';

interface TimeAllocationChartProps {
  activities: ScheduleActivity[];
  goals: Goal[];
  timeRange: string;
  isMobile: boolean;
}

export function TimeAllocationChart({
  activities,
  goals,
  timeRange,
  isMobile
}: TimeAllocationChartProps) {
  const timeData = useMemo(() => {
    const goalTimeMap = new Map<string, { hours: number; count: number; color: string; name: string }>();
    
    // Initialize all goals with 0 hours
    goals.forEach(goal => {
      goalTimeMap.set(goal.id, { hours: 0, count: 0, color: goal.color, name: goal.name });
    });

    // Calculate time spent on each goal
    activities.forEach(activity => {
      if (activity.status === 'completed') {
        const start = new Date(`2000-01-01T${activity.startTime}`);
        const end = new Date(`2000-01-01T${activity.endTime}`);
        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        
        const existing = goalTimeMap.get(activity.goalId);
        if (existing) {
          existing.hours += duration;
          existing.count += 1;
        }
      }
    });

    // Convert to array and sort by hours
    const sortedData = Array.from(goalTimeMap.values())
      .filter(item => item.hours > 0)
      .sort((a, b) => b.hours - a.hours);

    const totalHours = sortedData.reduce((sum, item) => sum + item.hours, 0);

    return {
      data: sortedData,
      totalHours,
      totalActivities: activities.filter(a => a.status === 'completed').length
    };
  }, [activities, goals]);

  if (timeData.data.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No time data available
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Complete some scheduled activities to see time allocation data
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
            Time Allocation
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            How your time is distributed across goals
          </p>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {timeData.totalHours.toFixed(1)}h
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Total tracked time
          </div>
        </div>
      </div>

      {/* Pie Chart Visualization */}
      <div className="flex flex-col lg:flex-row items-center gap-8">
        {/* Pie Chart */}
        <div className="relative w-64 h-64 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {(() => {
              let currentAngle = 0;
              return timeData.data.map((item, index) => {
                const percentage = (item.hours / timeData.totalHours) * 100;
                const angle = (percentage / 100) * 360;
                const startAngle = currentAngle;
                const endAngle = currentAngle + angle;
                
                const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
                
                const largeArcFlag = angle > 180 ? 1 : 0;
                
                const pathData = [
                  `M 50 50`,
                  `L ${x1} ${y1}`,
                  `A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                  'Z'
                ].join(' ');
                
                currentAngle += angle;
                
                return (
                  <path
                    key={index}
                    d={pathData}
                    fill={item.color}
                    stroke="white"
                    strokeWidth="2"
                    className="transition-all duration-300 hover:opacity-80"
                  />
                );
              });
            })()}
          </svg>
          
          {/* Center Text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {timeData.totalHours.toFixed(1)}h
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Total
              </div>
            </div>
          </div>
        </div>

        {/* Legend and Details */}
        <div className="flex-1 min-w-0">
          <div className="space-y-3">
            {timeData.data.map((item, index) => {
              const percentage = (item.hours / timeData.totalHours) * 100;
              
              return (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {item.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {item.count} activities
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {item.hours.toFixed(1)}h
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Time Distribution Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3 mb-2">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h5 className="font-medium text-gray-900 dark:text-white">Most Active Goal</h5>
          </div>
          {timeData.data.length > 0 && (
            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {timeData.data[0].name}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {timeData.data[0].hours.toFixed(1)}h ({((timeData.data[0].hours / timeData.totalHours) * 100).toFixed(1)}%)
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3 mb-2">
            <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h5 className="font-medium text-gray-900 dark:text-white">Goals with Activity</h5>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {timeData.data.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            of {goals.length} total goals
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3 mb-2">
            <PieChart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h5 className="font-medium text-gray-900 dark:text-white">Avg. Session Length</h5>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {timeData.totalActivities > 0 ? (timeData.totalHours / timeData.totalActivities).toFixed(1) : 0}h
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            per activity
          </div>
        </div>
      </div>

      {/* Time Efficiency Insights */}
      {timeData.data.length > 1 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            Time Distribution Insights
          </h5>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <p>
              • <strong>{timeData.data[0].name}</strong> receives the most attention with{' '}
              {((timeData.data[0].hours / timeData.totalHours) * 100).toFixed(1)}% of your time
            </p>
            {timeData.data.length > 2 && (
              <p>
                • The top 3 goals account for{' '}
                {((timeData.data.slice(0, 3).reduce((sum, item) => sum + item.hours, 0) / timeData.totalHours) * 100).toFixed(1)}% of your total time
              </p>
            )}
            <p>
              • You're actively working on <strong>{timeData.data.length}</strong> different goal areas
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
