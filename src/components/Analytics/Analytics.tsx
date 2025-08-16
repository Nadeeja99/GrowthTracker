'use client';

import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, PieChart, Calendar, Target, Clock, Award, Activity, Filter, Download, RefreshCw } from 'lucide-react';
import { Goal, ScheduleActivity, Task, Achievement, DailyRating } from '@/types';
import { cn } from '@/lib/utils';
import { GoalProgressChart } from './GoalProgressChart';
import { TimeAllocationChart } from './TimeAllocationChart';
import { WeeklyTrendsChart } from './WeeklyTrendsChart';
import { HabitStrengthChart } from './HabitStrengthChart';
import { CompletionRateChart } from './CompletionRateChart';
import { ProductivityInsights } from './ProductivityInsights';

interface AnalyticsProps {
  goals: Goal[];
  activities: ScheduleActivity[];
  tasks: Task[];
  achievements: Achievement[];
  dailyRatings: DailyRating[];
  isMobile: boolean;
}

type TimeRange = 'week' | 'month' | 'quarter' | 'year';
type ChartType = 'progress' | 'time' | 'trends' | 'habits' | 'completion';

export function Analytics({
  goals,
  activities,
  tasks,
  achievements,
  dailyRatings,
  isMobile
}: AnalyticsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [selectedGoal, setSelectedGoal] = useState<string>('all');
  const [activeChart, setActiveChart] = useState<ChartType>('progress');

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    const now = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Filter data by time range
    const filteredActivities = activities.filter(activity => 
      new Date(activity.date) >= startDate && new Date(activity.date) <= now
    );

    const filteredTasks = tasks.filter(task => 
      new Date(task.createdAt) >= startDate && new Date(task.createdAt) <= now
    );

    const filteredRatings = dailyRatings.filter(rating => 
      new Date(rating.date) >= startDate && new Date(rating.date) <= now
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

    const totalStreaks = goals.reduce((sum, goal) => sum + goal.streakDays, 0);

    return {
      totalHours,
      completedTasks,
      totalTasks,
      completionRate,
      averageRating,
      totalStreaks,
      filteredActivities: goalFilteredActivities,
      filteredTasks: goalFilteredTasks,
      filteredRatings,
      startDate,
      endDate: now
    };
  }, [goals, activities, tasks, dailyRatings, timeRange, selectedGoal]);

  const chartOptions = [
    { id: 'progress', label: 'Goal Progress', icon: Target, description: 'Progress tracking by goal' },
    { id: 'time', label: 'Time Allocation', icon: Clock, description: 'How time is distributed' },
    { id: 'trends', label: 'Weekly Trends', icon: TrendingUp, description: 'Performance over time' },
    { id: 'habits', label: 'Habit Strength', icon: Activity, description: 'Consistency patterns' },
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
    a.download = `growth-tracker-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
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
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                Analytics & Insights
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Track your progress and discover productivity patterns
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportData}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
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
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Goal Filter */}
          <select
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Goals</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>{goal.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {analyticsData.totalHours.toFixed(1)}h
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Total Hours
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
            <Award className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {analyticsData.completionRate.toFixed(0)}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Completion Rate
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
            <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {analyticsData.averageRating.toFixed(1)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Avg. Rating
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {analyticsData.totalStreaks}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Total Streaks
          </div>
        </div>
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
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {getGoalName(selectedGoal)} - {timeRangeOptions.find(opt => opt.id === timeRange)?.label}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {analyticsData.startDate.toLocaleDateString()} - {analyticsData.endDate.toLocaleDateString()}
          </p>
        </div>

        {activeChart === 'progress' && (
          <GoalProgressChart 
            goals={goals} 
            timeRange={timeRange}
            selectedGoal={selectedGoal}
            isMobile={isMobile}
          />
        )}

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

        {activeChart === 'habits' && (
          <HabitStrengthChart 
            activities={analyticsData.filteredActivities}
            goals={goals}
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
