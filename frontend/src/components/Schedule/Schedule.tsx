'use client';

import React, { useState } from 'react';
import { Calendar, Clock, Plus, Settings, FileText, CalendarDays } from 'lucide-react';
import { ScheduleTemplate, ScheduleActivity, Goal } from '@/types';
import { cn } from '@/lib/utils';
import { ScheduleCalendar } from './ScheduleCalendar';
import { ScheduleTemplates } from './ScheduleTemplates';
import { DailySchedule } from './DailySchedule';
import { ActivityForm } from './ActivityForm';
import { TemplateForm } from './TemplateForm';

interface ScheduleProps {
  goals: Goal[];
  activities: ScheduleActivity[];
  scheduleTemplates: ScheduleTemplate[];
  onActivityStatusChange: (activityId: string, status: ScheduleActivity['status']) => void;
  onCreateActivity: (activity: Omit<ScheduleActivity, 'id'>) => void;
  onUpdateActivity: (activityId: string, updates: Partial<ScheduleActivity>) => void;
  onDeleteActivity: (activityId: string) => void;
  onCreateTemplate: (template: Omit<ScheduleTemplate, 'id'>) => void;
  onUpdateTemplate: (templateId: string, updates: Partial<ScheduleTemplate>) => void;
  onDeleteTemplate: (templateId: string) => void;
  isMobile: boolean;
}

type ScheduleView = 'calendar' | 'daily' | 'templates';

export function Schedule({
  goals,
  activities,
  scheduleTemplates,
  onActivityStatusChange,
  onCreateActivity,
  onUpdateActivity,
  onDeleteActivity,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  isMobile
}: ScheduleProps) {
  const [currentView, setCurrentView] = useState<ScheduleView>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ScheduleActivity | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ScheduleTemplate | null>(null);

  const handleCreateActivity = () => {
    setEditingActivity(null);
    setShowActivityForm(true);
  };

  const handleEditActivity = (activity: ScheduleActivity) => {
    setEditingActivity(activity);
    setShowActivityForm(true);
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setShowTemplateForm(true);
  };

  const handleEditTemplate = (template: ScheduleTemplate) => {
    setEditingTemplate(template);
    setShowTemplateForm(true);
  };

  const handleActivitySubmit = (activityData: Omit<ScheduleActivity, 'id'>) => {
    if (editingActivity) {
      onUpdateActivity(editingActivity.id, activityData);
    } else {
      onCreateActivity(activityData);
    }
    setShowActivityForm(false);
    setEditingActivity(null);
  };

  const handleTemplateSubmit = (templateData: Omit<ScheduleTemplate, 'id'>) => {
    if (editingTemplate) {
      onUpdateTemplate(editingTemplate.id, templateData);
    } else {
      onCreateTemplate(templateData);
    }
    setShowTemplateForm(false);
    setEditingTemplate(null);
  };

  const viewOptions = [
    { id: 'calendar', label: 'Calendar', icon: Calendar, description: 'Weekly overview' },
    { id: 'daily', label: 'Daily View', icon: Clock, description: 'Hour-by-hour breakdown' },
    { id: 'templates', label: 'Templates', icon: FileText, description: 'Schedule templates' }
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                Schedule Management
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Plan and organize your daily activities
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCreateActivity}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Activity</span>
            </button>
            <button
              onClick={handleCreateTemplate}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">New Template</span>
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {viewOptions.map((option) => {
            const Icon = option.icon;
            const isActive = currentView === option.id;
            
            return (
              <button
                key={option.id}
                onClick={() => setCurrentView(option.id as ScheduleView)}
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

      {/* Main Content */}
      <div className="grid gap-4 md:gap-6">
        {currentView === 'calendar' && (
          <ScheduleCalendar
            goals={goals}
            activities={activities}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onActivityClick={handleEditActivity}
            onActivityStatusChange={onActivityStatusChange}
            isMobile={isMobile}
          />
        )}

        {currentView === 'daily' && (
          <DailySchedule
            goals={goals}
            activities={activities}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onActivityClick={handleEditActivity}
            onActivityStatusChange={onActivityStatusChange}
            onCreateActivity={handleCreateActivity}
            isMobile={isMobile}
          />
        )}

        {currentView === 'templates' && (
          <ScheduleTemplates
            goals={goals}
            templates={scheduleTemplates}
            onEditTemplate={handleEditTemplate}
            onDeleteTemplate={onDeleteTemplate}
            isMobile={isMobile}
          />
        )}
      </div>

      {/* Activity Form Modal */}
      {showActivityForm && (
        <ActivityForm
          goals={goals}
          activity={editingActivity}
          onSubmit={handleActivitySubmit}
          onCancel={() => {
            setShowActivityForm(false);
            setEditingActivity(null);
          }}
          isMobile={isMobile}
        />
      )}

      {/* Template Form Modal */}
      {showTemplateForm && (
        <TemplateForm
          goals={goals}
          template={editingTemplate}
          onSubmit={handleTemplateSubmit}
          onCancel={() => {
            setShowTemplateForm(false);
            setEditingTemplate(null);
          }}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
