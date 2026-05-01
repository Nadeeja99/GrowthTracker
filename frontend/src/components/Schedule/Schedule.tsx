'use client';

import React, { useState } from 'react';
import { Calendar, Clock, Plus, FileText, RotateCcw } from 'lucide-react';
import { ScheduleTemplate, ScheduleActivity, Goal, Task } from '@/types';
import { cn } from '@/lib/utils';
import { ScheduleCalendar } from './ScheduleCalendar';
import { ScheduleTemplates } from './ScheduleTemplates';
import { DailySchedule } from './DailySchedule';
import { ActivityForm } from './ActivityForm';
import { TemplateForm } from './TemplateForm';
import { RecurringScheduleForm } from './RecurringScheduleForm';

interface ScheduleProps {
  goals: Goal[];
  tasks: Task[];
  activities: ScheduleActivity[];
  scheduleTemplates: ScheduleTemplate[];
  onActivityStatusChange: (activityId: string, status: ScheduleActivity['status']) => void;
  onCreateActivity: (activity: Omit<ScheduleActivity, 'id'>) => void;
  onCreateActivities: (activities: Array<Omit<ScheduleActivity, 'id'>>) => Promise<void>;
  onUpdateActivity: (activityId: string, updates: Partial<ScheduleActivity>) => void;
  onDeleteActivity: (activityId: string) => void;
  onCreateTemplate: (template: Omit<ScheduleTemplate, 'id'>) => void;
  onUpdateTemplate: (templateId: string, updates: Partial<ScheduleTemplate>) => void;
  onDeleteTemplate: (templateId: string) => void;
  isMobile: boolean;
}

type ScheduleView = 'calendar' | 'daily' | 'templates';
type ModalType = 'activity' | 'recurring' | 'template' | null;

export function Schedule({
  goals,
  tasks,
  activities,
  scheduleTemplates,
  onActivityStatusChange,
  onCreateActivity,
  onCreateActivities,
  onUpdateActivity,
  onDeleteActivity,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  isMobile,
}: ScheduleProps) {
  const [currentView, setCurrentView] = useState<ScheduleView>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [modal, setModal] = useState<ModalType>(null);
  const [editingActivity, setEditingActivity] = useState<ScheduleActivity | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ScheduleTemplate | null>(null);
  const [recurringBusy, setRecurringBusy] = useState(false);

  const closeModal = () => { setModal(null); setEditingActivity(null); setEditingTemplate(null); };

  const handleEditActivity = (activity: ScheduleActivity) => {
    setEditingActivity(activity);
    setModal('activity');
  };

  const handleActivitySubmit = (activityData: Omit<ScheduleActivity, 'id' | 'taskTitle'>) => {
    if (editingActivity) {
      onUpdateActivity(editingActivity.id, activityData);
    } else {
      onCreateActivity(activityData);
    }
    closeModal();
  };

  const handleRecurringSubmit = async (activitiesList: Array<Omit<ScheduleActivity, 'id' | 'taskTitle'>>) => {
    setRecurringBusy(true);
    try {
      await onCreateActivities(activitiesList);
      closeModal();
    } finally {
      setRecurringBusy(false);
    }
  };

  const handleTemplateSubmit = (templateData: Omit<ScheduleTemplate, 'id'>) => {
    if (editingTemplate) {
      onUpdateTemplate(editingTemplate.id, templateData);
    } else {
      onCreateTemplate(templateData);
    }
    closeModal();
  };

  const viewOptions = [
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'daily', label: 'Daily', icon: Clock },
    { id: 'templates', label: 'Templates', icon: FileText },
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
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Schedule</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Plan and manage your time blocks</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => { setEditingActivity(null); setModal('activity'); }}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </button>
            <button
              onClick={() => setModal('recurring')}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Recurring</span>
            </button>
            <button
              onClick={() => { setEditingTemplate(null); setModal('template'); }}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Template</span>
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {viewOptions.map(option => {
            const Icon = option.icon;
            const isActive = currentView === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setCurrentView(option.id as ScheduleView)}
                className={cn(
                  'flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all flex-1',
                  isActive
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Views */}
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
          tasks={tasks}
          activities={activities}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          onActivityClick={handleEditActivity}
          onActivityStatusChange={onActivityStatusChange}
          onCreateActivity={() => { setEditingActivity(null); setModal('activity'); }}
          isMobile={isMobile}
        />
      )}

      {currentView === 'templates' && (
        <ScheduleTemplates
          goals={goals}
          templates={scheduleTemplates}
          onEditTemplate={t => { setEditingTemplate(t); setModal('template'); }}
          onDeleteTemplate={onDeleteTemplate}
          isMobile={isMobile}
        />
      )}

      {/* Modals */}
      {modal === 'activity' && (
        <ActivityForm
          goals={goals}
          tasks={tasks}
          activity={editingActivity}
          onSubmit={handleActivitySubmit}
          onCancel={closeModal}
          isMobile={isMobile}
        />
      )}

      {modal === 'recurring' && (
        <RecurringScheduleForm
          goals={goals}
          tasks={tasks}
          onSubmit={handleRecurringSubmit}
          onCancel={closeModal}
          isMobile={isMobile}
        />
      )}

      {recurringBusy && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 flex flex-col items-center gap-4 shadow-xl">
            <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-700 dark:text-gray-300 font-medium">Creating recurring sessions…</p>
          </div>
        </div>
      )}

      {modal === 'template' && (
        <TemplateForm
          goals={goals}
          template={editingTemplate}
          onSubmit={handleTemplateSubmit}
          onCancel={closeModal}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
