'use client';

import React, { useState } from 'react';
import { FileText, Edit, Trash2, Copy, Play, Calendar, Clock, Target, Plus, XCircle } from 'lucide-react';
import { Goal, ScheduleTemplate } from '@/types';
import { cn } from '@/lib/utils';

interface ScheduleTemplatesProps {
  goals: Goal[];
  templates: ScheduleTemplate[];
  onEditTemplate: (template: ScheduleTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  isMobile: boolean;
}

export function ScheduleTemplates({
  goals,
  templates,
  onEditTemplate,
  onDeleteTemplate,
  isMobile
}: ScheduleTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const getGoalColor = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    return goal?.color || '#6B7280';
  };

  const getGoalName = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    return goal?.name || 'Unknown Goal';
  };

  const getTypeIcon = (type: ScheduleTemplate['type']) => {
    switch (type) {
      case 'workday':
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'weekend':
        return <Target className="w-4 h-4 text-purple-500" />;
      case 'busy':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'low-energy':
        return <Target className="w-4 h-4 text-green-500" />;
      case 'travel':
        return <Play className="w-4 h-4 text-indigo-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: ScheduleTemplate['type']) => {
    switch (type) {
      case 'workday':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
      case 'weekend':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300';
      case 'busy':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300';
      case 'low-energy':
        return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
      case 'travel':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
    }
  };

  const getTypeLabel = (type: ScheduleTemplate['type']) => {
    switch (type) {
      case 'workday':
        return 'Work Day';
      case 'weekend':
        return 'Weekend';
      case 'busy':
        return 'Busy Day';
      case 'low-energy':
        return 'Low Energy';
      case 'travel':
        return 'Travel';
      default:
        return 'Custom';
    }
  };

  const filteredTemplates = filterType === 'all' 
    ? templates 
    : templates.filter(t => t.type === filterType);

  const totalHours = (template: ScheduleTemplate) => {
    return template.activities.reduce((total, activity) => {
      const start = new Date(`2000-01-01T${activity.startTime}`);
      const end = new Date(`2000-01-01T${activity.endTime}`);
      return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }, 0);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
                Schedule Templates
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                Reusable schedule configurations for different day types
              </p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {[
            { id: 'all', label: 'All Types' },
            { id: 'workday', label: 'Work Days' },
            { id: 'weekend', label: 'Weekends' },
            { id: 'busy', label: 'Busy Days' },
            { id: 'low-energy', label: 'Low Energy' },
            { id: 'travel', label: 'Travel' }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilterType(filter.id)}
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium transition-all duration-200',
                filterType === filter.id
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 hover:shadow-md transition-shadow"
          >
            {/* Template Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                {getTypeIcon(template.type)}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {template.name}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className={cn(
                      'px-2 py-1 rounded text-xs font-medium',
                      getTypeColor(template.type)
                    )}>
                      {getTypeLabel(template.type)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {template.activities.length} activities
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onEditTemplate(template)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteTemplate(template.id)}
                  className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Template Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {totalHours(template).toFixed(1)}h
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Hours</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {template.activities.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Activities</div>
              </div>
            </div>

            {/* Activities Preview */}
            <div className="space-y-2">
              {template.activities.slice(0, 3).map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                >
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getGoalColor(activity.goalId) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {activity.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {activity.startTime} - {activity.endTime}
                    </div>
                  </div>
                </div>
              ))}
              
              {template.activities.length > 3 && (
                <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                  +{template.activities.length - 3} more activities
                </div>
              )}
            </div>

            {/* Template Actions */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedTemplate(template)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  View Details
                </button>
                <button className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
                  <Copy className="w-3 h-3" />
                  <span>Use Template</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No templates found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {filterType === 'all' 
              ? 'Create your first schedule template to get started'
              : `No ${filterType} templates available`
            }
          </p>
          {filterType === 'all' && (
            <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 mx-auto">
              <Plus className="w-4 h-4" />
              <span>Create Template</span>
            </button>
          )}
        </div>
      )}

      {/* Template Details Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selectedTemplate.name}
                </h3>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(selectedTemplate.type)}
                  <span className={cn(
                    'px-2 py-1 rounded text-sm font-medium',
                    getTypeColor(selectedTemplate.type)
                  )}>
                    {getTypeLabel(selectedTemplate.type)}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {totalHours(selectedTemplate).toFixed(1)}h
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total Hours</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedTemplate.activities.length}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Activities</div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">Activities</h4>
                  {selectedTemplate.activities.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getGoalColor(activity.goalId) }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {activity.title}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {getGoalName(activity.goalId)} • {activity.startTime} - {activity.endTime}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
