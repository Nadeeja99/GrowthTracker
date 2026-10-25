'use client';

import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Clock, Award, Repeat, Battery, Download } from 'lucide-react';
import { Goal, ScheduleActivity, Task, DailyRating } from '@/types';
import { cn } from '@/lib/utils';
import { TimeAllocationChart } from './TimeAllocationChart';
import { WeeklyTrendsChart } from './WeeklyTrendsChart';
import { CompletionRateChart } from './CompletionRateChart';
import { ProductivityInsights } from './ProductivityInsights';
import { parseDateKey, toDateKey } from '@/lib/dates';
import { AnalyticsOverview } from '@/lib/api';

export type TimeRange = 'week' | 'month' | 'quarter' | 'year';

/** First day included in a range ending today. */
export function getRangeStart(range: TimeRange, now = new Date()): Date {
  const start = new Date(now);
  if (range === 'week') start.setDate(now.getDate() - 7);
  else if (range === 'month') start.setMonth(now.getMonth() - 1);
  else if (range === 'quarter') start.setMonth(now.getMonth() - 3);
  else start.setFullYear(now.getFullYear() - 1);
  return start;
}

/** Client-side aggregates for the selected range and goal filter. */
export interface AnalyticsData {
  totalHours: number;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  averageRating: number;
  filteredActivities: ScheduleActivity[];
  filteredTasks: Task[];
  filteredRatings: DailyRating[];
  startDate: Date;
  endDate: Date;
}

interface AnalyticsProps {
  goals: Goal[];
  activities: ScheduleActivity[];
  tasks: Task[];
  dailyRatings: DailyRating[];
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  /** Server-computed totals for the same range (undefined while loading). */
  summary?: AnalyticsOverview;
  isMobile: boolean;
}
type ChartType = 'time' | 'trends' | 'completion';

export function Analytics({
  goals,
  activities,
  tasks,
  dailyRatings,
  timeRange,
  onTimeRangeChange: setTimeRange,
  summary,
  isMobile
}: AnalyticsProps) {
  const [selectedGoal, setSelectedGoal] = useState<string>('all');
  const [activeChart, setActiveChart] = useState<ChartType>('time');

  // Calculate analytics data
  const analyticsData = useMemo((): AnalyticsData => {
    const now = new Date();
    const startDate = getRangeStart(timeRange, now);

    // Filter data by time range
    const filteredActivities = activities.filter(activity => 
      parseDateKey(activity.date) >= startDate && parseDateKey(activity.date) <= now
    );

    const filteredTasks = tasks.filter(task => 
      new Date(task.createdAt) >= startDate && new Date(task.createdAt) <= now
    );

    const filteredRatings = dailyRatings.filter(rating => 
      parseDateKey(rating.date) >= startDate && parseDateKey(rating.date) <= now
    );

    // Goal-specific filtering
    const goalFilteredActivities = selectedGoal === 'all' 
      ? filteredActivities 
      : filteredActivities.filter(activity => activity.goalId === selectedGoal);

    const goalFilteredTasks = selectedGoal === 'all'
      ? filteredTasks
      : filteredTasks.filter(task => task.goalId === selectedGoal);

    // Calculate key metrics
    const totalHours = goalFilteredActivities.reduce((total, activity) => {
      if (activity.status === 'completed') {
        const start = new Date(`2000-01-01T${activity.startTime}`);
        const end = new Date(`2000-01-01T${activity.endTime}`);
        return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }
      return total;
    }, 0);

    const completedTasks = goalFilteredTasks.filter(task => task.status === 'completed').length;
    const totalTasks = goalFilteredTasks.length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const averageRating = filteredRatings.length > 0 
      ? filteredRatings.reduce((sum, rating) => sum + rating.performance, 0) / filteredRatings.length 
      : 0;

    return {
      totalHours,
      completedTasks,
      totalTasks,
      completionRate,
      averageRating,
      filteredActivities: goalFilteredActivities,
      filteredTasks: goalFilteredTasks,
      filteredRatings,
      startDate,
      endDate: now
    };
  }, [activities, tasks, dailyRatings, timeRange, selectedGoal]);

  const chartOptions = [
    { id: 'time', label: 'Time Allocation', icon: Clock, description: 'How time is distributed' },
    { id: 'trends', label: 'Weekly Trends', icon: TrendingUp, description: 'Performance over time' },
    { id: 'completion', label: 'Completion Rates', icon: Award, description: 'Task success metrics' }
  ];

  const timeRangeOptions = [
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'quarter', label: 'This Quarter' },
    { id: 'year', label: 'This Year' }
  ];

  const handleExportData = () => {
    const data = {
      timeRange,
      selectedGoal: selectedGoal === 'all' ? 'All Goals' : goals.find(g => g.id === selectedGoal)?.name,
      analytics: analyticsData,
      goals: goals.map(goal => ({
        name: goal.name,
        progress: (goal.currentWeeklyHours / goal.targetHoursWeekly) * 100,
        currentHours: goal.currentWeeklyHours,
        targetHours: goal.targetHoursWeekly,
        streak: goal.streakDays
      })),
      activities: analyticsData.filteredActivities,
      tasks: analyticsData.filteredTasks,
      ratings: analyticsData.filteredRatings
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `growth-tracker-analytics-${timeRange}-${toDateKey()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getGoalName = (goalId: string) => {
    if (goalId === 'all') return 'All Goals';
    const goal = goals.find(g => g.id === goalId);
    return goal?.name || 'Unknown Goal';
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                Insights
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Track your progress and discover productivity patterns
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export Data</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Time Range Filter */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {timeRangeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setTimeRange(option.id as TimeRange)}
                className={cn(
                  'px-3 py-1 rounded-md text-sm font-medium transition-all duration-200',
                  timeRange === option.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Goal Filter */}
          <select aria-label="Filter by goal"
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Goals</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>{goal.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Key metrics (server-computed for the selected range) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Focused time', icon: Clock, value: summary ? `${(summary.focus.totalMinutes / 60).toFixed(1)}h` : '—', hint: summary ? `${summary.focus.sessions} sessions` : '' },
          { label: 'Tasks completed', icon: Award, value: summary ? `${summary.tasks.completionRate}%` : '—', hint: summary ? `${summary.tasks.completed} of ${summary.tasks.total}` : '' },
          { label: 'Habit consistency', icon: Repeat, value: summary ? `${summary.habits.completionRate}%` : '—', hint: summary ? `${summary.habits.total} habits` : '' },
          { label: 'Avg. energy', icon: Battery, value: summary?.reflections.averageEnergy?.toFixed(1) ?? '—', hint: summary ? `${summary.reflections.days} reviews` : '' },
        ].map(({ label, icon: Icon, value, hint }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Icon className="w-4 h-4" /> {label}
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 h-4">{hint}</div>
          </div>
        ))}
      </div>

      {/* Chart Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {chartOptions.map((option) => {
            const Icon = option.icon;
            const isActive = activeChart === option.id;

            return (
              <button
                key={option.id}
                onClick={() => setActiveChart(option.id as ChartType)}
                className={cn(
                  'flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{option.label}</span>
                <span className="hidden lg:inline text-xs text-gray-500 dark:text-gray-400">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {getGoalName(selectedGoal)} - {timeRangeOptions.find(opt => opt.id === timeRange)?.label}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {analyticsData.startDate.toLocaleDateString()} - {analyticsData.endDate.toLocaleDateString()}
          </p>
        </div>


        {activeChart === 'time' && (
          <TimeAllocationChart 
            activities={analyticsData.filteredActivities}
            goals={goals}
            timeRange={timeRange}
            isMobile={isMobile}
          />
        )}

        {activeChart === 'trends' && (
          <WeeklyTrendsChart 
            activities={analyticsData.filteredActivities}
            tasks={analyticsData.filteredTasks}
            ratings={analyticsData.filteredRatings}
            timeRange={timeRange}
            isMobile={isMobile}
          />
        )}


        {activeChart === 'completion' && (
          <CompletionRateChart 
            tasks={analyticsData.filteredTasks}
            goals={goals}
            timeRange={timeRange}
            isMobile={isMobile}
          />
        )}
      </div>

      {/* Productivity Insights */}
      <ProductivityInsights 
        analyticsData={analyticsData}
        goals={goals}
        selectedGoal={selectedGoal}
        timeRange={timeRange}
        isMobile={isMobile}
      />
    </div>
  );
}
