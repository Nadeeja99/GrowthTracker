'use client';

import React from 'react';
import { Lightbulb, TrendingUp, Target, Clock, Award, AlertTriangle, CheckCircle, Star } from 'lucide-react';
import { Goal } from '@/types';
import { cn } from '@/lib/utils';

interface ProductivityInsightsProps {
  analyticsData: any;
  goals: Goal[];
  selectedGoal: string;
  timeRange: string;
  isMobile: boolean;
}

export function ProductivityInsights({
  analyticsData,
  goals,
  selectedGoal,
  timeRange,
  isMobile
}: ProductivityInsightsProps) {
  const generateInsights = () => {
    const insights = [];
    
    // Time-based insights
    if (analyticsData.totalHours > 0) {
      const avgDailyHours = analyticsData.totalHours / (timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : timeRange === 'quarter' ? 90 : 365);
      
      if (avgDailyHours >= 6) {
        insights.push({
          type: 'excellent',
          icon: Star,
          title: 'High Productivity Level',
          message: `You're averaging ${avgDailyHours.toFixed(1)} hours per day - excellent consistency!`,
          action: 'Consider setting more ambitious goals or helping others with your strategies.'
        });
      } else if (avgDailyHours >= 4) {
        insights.push({
          type: 'good',
          icon: CheckCircle,
          title: 'Good Daily Output',
          message: `Your daily average of ${avgDailyHours.toFixed(1)} hours shows solid productivity.`,
          action: 'Try adding one more focused session to reach the next level.'
        });
      } else if (avgDailyHours >= 2) {
        insights.push({
          type: 'moderate',
          icon: TrendingUp,
          title: 'Building Momentum',
          message: `You're averaging ${avgDailyHours.toFixed(1)} hours daily - good foundation!`,
          action: 'Focus on consistency rather than increasing hours right now.'
        });
      } else {
        insights.push({
          type: 'improvement',
          icon: Target,
          title: 'Room for Growth',
          message: `Current daily average: ${avgDailyHours.toFixed(1)} hours`,
          action: 'Start with 30-minute focused sessions and gradually increase duration.'
        });
      }
    }

    // Completion rate insights
    if (analyticsData.completionRate > 0) {
      if (analyticsData.completionRate >= 90) {
        insights.push({
          type: 'excellent',
          icon: Award,
          title: 'Outstanding Task Completion',
          message: `${analyticsData.completionRate.toFixed(0)}% completion rate shows excellent execution.`,
          action: 'Consider taking on more challenging projects or mentoring others.'
        });
      } else if (analyticsData.completionRate >= 75) {
        insights.push({
          type: 'good',
          icon: CheckCircle,
          title: 'Strong Task Management',
          message: `${analyticsData.completionRate.toFixed(0)}% completion rate indicates good planning.`,
          action: 'Review incomplete tasks and identify any patterns or blockers.'
        });
      } else if (analyticsData.completionRate >= 50) {
        insights.push({
          type: 'moderate',
          icon: TrendingUp,
          title: 'Improving Task Completion',
          message: `${analyticsData.completionRate.toFixed(0)}% completion rate shows progress.`,
          action: 'Break down larger tasks and set more realistic daily targets.'
        });
      } else {
        insights.push({
          type: 'improvement',
          icon: AlertTriangle,
          title: 'Task Completion Needs Attention',
          message: `${analyticsData.completionRate.toFixed(0)}% completion rate suggests room for improvement.`,
          action: 'Start with just 1-2 tasks per day and build from there.'
        });
      }
    }

    // Goal-specific insights
    if (selectedGoal !== 'all') {
      const goal = goals.find(g => g.id === selectedGoal);
      if (goal) {
        const progress = (goal.currentWeeklyHours / goal.targetHoursWeekly) * 100;
        
        if (progress >= 100) {
          insights.push({
            type: 'excellent',
            icon: Target,
            title: 'Goal Exceeded!',
            message: `${goal.name} target achieved with ${progress.toFixed(0)}% completion.`,
            action: 'Consider increasing your weekly target or adding new related goals.'
          });
        } else if (progress >= 80) {
          insights.push({
            type: 'good',
            icon: TrendingUp,
            title: 'On Track',
            message: `${goal.name} is ${progress.toFixed(0)}% complete - you're doing great!`,
            action: 'Maintain current pace to reach your target this week.'
          });
        } else if (progress >= 50) {
          insights.push({
            type: 'moderate',
            icon: Clock,
            title: 'Halfway There',
            message: `${goal.name} is ${progress.toFixed(0)}% complete.`,
            action: 'Increase daily sessions slightly to catch up to your target.'
          });
        } else {
          insights.push({
            type: 'improvement',
            icon: AlertTriangle,
            title: 'Behind Schedule',
            message: `${goal.name} is only ${progress.toFixed(0)}% complete.`,
            action: 'Double your daily effort or adjust your weekly target if needed.'
          });
        }
      }
    }

    // Consistency insights
    if (analyticsData.filteredActivities.length > 0) {
      const activeDays = new Set(analyticsData.filteredActivities.map((a: any) => a.date)).size;
      const totalDays = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : timeRange === 'quarter' ? 90 : 365;
      const consistencyRate = (activeDays / totalDays) * 100;
      
      if (consistencyRate >= 80) {
        insights.push({
          type: 'excellent',
          icon: Star,
          title: 'Exceptional Consistency',
          message: `You're active ${consistencyRate.toFixed(0)}% of the time - amazing dedication!`,
          action: 'Your consistency is a strength. Consider sharing your methods with others.'
        });
      } else if (consistencyRate >= 60) {
        insights.push({
          type: 'good',
          icon: CheckCircle,
          title: 'Good Consistency',
          message: `${consistencyRate.toFixed(0)}% consistency shows good habit formation.`,
          action: 'Try to add 1-2 more active days per week to improve consistency.'
        });
      } else {
        insights.push({
          type: 'improvement',
          icon: Target,
          title: 'Building Consistency',
          message: `${consistencyRate.toFixed(0)}% consistency indicates room for improvement.`,
          action: 'Focus on daily micro-habits rather than trying to do everything at once.'
        });
      }
    }

    return insights;
  };

  const insights = generateInsights();

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'excellent':
        return 'border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20';
      case 'good':
        return 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20';
      case 'moderate':
        return 'border-yellow-200 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20';
      case 'improvement':
        return 'border-orange-200 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20';
      default:
        return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20';
    }
  };

  const getInsightIconColor = (type: string) => {
    switch (type) {
      case 'excellent':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'good':
        return 'text-blue-600 dark:text-blue-400';
      case 'moderate':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'improvement':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (insights.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center">
          <Lightbulb className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No insights available yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Complete more activities and tasks to receive personalized productivity insights
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Productivity Insights
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Personalized recommendations based on your data
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {insights.map((insight, index) => {
          const Icon = insight.icon;
          
          return (
            <div key={index} className={cn("border rounded-lg p-4", getInsightColor(insight.type))}>
              <div className="flex items-start space-x-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", getInsightColor(insight.type))}>
                  <Icon className={cn("w-4 h-4", getInsightIconColor(insight.type))} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    {insight.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {insight.message}
                  </p>
                  <div className="bg-white dark:bg-gray-600 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-500">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      💡 Action: {insight.action}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Recommendations */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          Key Recommendations
        </h4>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          {(() => {
            const excellentCount = insights.filter(i => i.type === 'excellent').length;
            const improvementCount = insights.filter(i => i.type === 'improvement').length;
            
            if (excellentCount >= insights.length * 0.5) {
              return (
                <p className="text-emerald-600 dark:text-emerald-400">
                  🎉 You're performing excellently across most areas! Focus on maintaining momentum and helping others.
                </p>
              );
            } else if (improvementCount >= insights.length * 0.5) {
              return (
                <p className="text-orange-600 dark:text-orange-400">
                  📈 Several areas need attention. Focus on one improvement at a time for sustainable progress.
                </p>
              );
            } else {
              return (
                <p className="text-blue-600 dark:text-blue-400">
                  ✅ Good overall performance with room for growth. Pick 1-2 areas to focus on this week.
                </p>
              );
            }
          })()}
          
          <p>
            • Review these insights weekly to track your progress
          </p>
          <p>
            • Focus on consistency rather than perfection
          </p>
          <p>
            • Celebrate small wins and build momentum gradually
          </p>
        </div>
      </div>
    </div>
  );
}
