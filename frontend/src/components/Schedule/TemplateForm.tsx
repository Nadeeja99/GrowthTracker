'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Plus, Trash2, Clock, Target } from 'lucide-react';
import { Goal, ScheduleTemplate } from '@/types';
import { cn } from '@/lib/utils';

interface TemplateFormProps {
  goals: Goal[];
  template?: ScheduleTemplate | null;
  onSubmit: (template: Omit<ScheduleTemplate, 'id'>) => void;
  onCancel: () => void;
  isMobile: boolean;
}

export function TemplateForm({
  goals,
  template,
  onSubmit,
  onCancel,
  isMobile
}: TemplateFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'workday' as ScheduleTemplate['type'],
    activities: [] as Array<{
      goalId: string;
      title: string;
      startTime: string;
      endTime: string;
    }>
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        type: template.type,
        activities: template.activities
      });
    } else if (goals.length > 0) {
      setFormData(prev => ({ 
        ...prev, 
        activities: [{
          goalId: goals[0].id,
          title: '',
          startTime: '09:00',
          endTime: '10:00'
        }]
      }));
    }
  }, [template, goals]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Please enter a template name';
    }
    if (formData.activities.length === 0) {
      newErrors.activities = 'Please add at least one activity';
    }

    // Validate activities
    formData.activities.forEach((activity, index) => {
      if (!activity.title.trim()) {
        newErrors[`activity-${index}-title`] = 'Please enter an activity title';
      }
      if (!activity.goalId) {
        newErrors[`activity-${index}-goal`] = 'Please select a goal';
      }
      if (activity.startTime && activity.endTime) {
        const start = new Date(`2000-01-01T${activity.startTime}`);
        const end = new Date(`2000-01-01T${activity.endTime}`);
        if (start >= end) {
          newErrors[`activity-${index}-time`] = 'End time must be after start time';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addActivity = () => {
    setFormData(prev => ({
      ...prev,
      activities: [
        ...prev.activities,
        {
          goalId: goals[0]?.id || '',
          title: '',
          startTime: '09:00',
          endTime: '10:00'
        }
      ]
    }));
  };

  const removeActivity = (index: number) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.filter((_, i) => i !== index)
    }));
  };

  const updateActivity = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.map((activity, i) => 
        i === index ? { ...activity, [field]: value } : activity
      )
    }));
  };

  const getGoalColor = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    return goal?.color || '#6B7280';
  };

  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  });

  const totalHours = formData.activities.reduce((total, activity) => {
    const start = new Date(`2000-01-01T${activity.startTime}`);
    const end = new Date(`2000-01-01T${activity.endTime}`);
    return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={cn(
        'bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto',
        isMobile && 'max-w-full mx-4'
      )}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {template ? 'Edit Template' : 'Create Template'}
              </h2>
            </div>
            <button
              onClick={onCancel}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter template name"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Template Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="workday">Work Day</option>
                  <option value="weekend">Weekend</option>
                  <option value="busy">Busy Day</option>
                  <option value="low-energy">Low Energy</option>
                  <option value="travel">Travel</option>
                </select>
              </div>
            </div>

            {/* Activities Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Activities
                </h3>
                <button
                  type="button"
                  onClick={addActivity}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Activity</span>
                </button>
              </div>

              {formData.activities.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p>No activities added yet</p>
                  <p className="text-sm">Click "Add Activity" to get started</p>
                </div>
              )}

              <div className="space-y-4">
                {formData.activities.map((activity, index) => (
                  <div
                    key={index}
                    className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Activity {index + 1}
                      </h4>
                      <button
                        type="button"
                        onClick={() => removeActivity(index)}
                        className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Goal Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Goal Area
                        </label>
                        <select
                          value={activity.goalId}
                          onChange={(e) => updateActivity(index, 'goalId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select a goal</option>
                          {goals.map((goal) => (
                            <option key={goal.id} value={goal.id}>
                              {goal.name}
                            </option>
                          ))}
                        </select>
                        {errors[`activity-${index}-goal`] && (
                          <p className="text-red-500 text-sm mt-1">{errors[`activity-${index}-goal`]}</p>
                        )}
                      </div>

                      {/* Title */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Activity Title
                        </label>
                        <input
                          type="text"
                          value={activity.title}
                          onChange={(e) => updateActivity(index, 'title', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter activity title"
                        />
                        {errors[`activity-${index}-title`] && (
                          <p className="text-red-500 text-sm mt-1">{errors[`activity-${index}-title`]}</p>
                        )}
                      </div>

                      {/* Start Time */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Start Time
                        </label>
                        <select
                          value={activity.startTime}
                          onChange={(e) => updateActivity(index, 'startTime', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {timeOptions.map((time) => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                      </div>

                      {/* End Time */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          End Time
                        </label>
                        <select
                          value={activity.endTime}
                          onChange={(e) => updateActivity(index, 'endTime', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {timeOptions.map((time) => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                        {errors[`activity-${index}-time`] && (
                          <p className="text-red-500 text-sm mt-1">{errors[`activity-${index}-time`]}</p>
                        )}
                      </div>
                    </div>

                    {/* Activity Preview */}
                    {activity.goalId && activity.title && (
                      <div className="mt-3 p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getGoalColor(activity.goalId) }}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {activity.title}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {goals.find(g => g.id === activity.goalId)?.name} • {activity.startTime} - {activity.endTime}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {errors.activities && (
                <p className="text-red-500 text-sm mt-1">{errors.activities}</p>
              )}
            </div>

            {/* Summary */}
            {formData.activities.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Template Summary</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700 dark:text-blue-300">Total Activities:</span>
                    <span className="ml-2 font-medium text-blue-900 dark:text-blue-100">
                      {formData.activities.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-300">Total Hours:</span>
                    <span className="ml-2 font-medium text-blue-900 dark:text-blue-100">
                      {totalHours.toFixed(1)}h
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{template ? 'Update' : 'Create'} Template</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
