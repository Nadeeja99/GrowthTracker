'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Layout/Header';
import { MobileNavigation } from '@/components/Layout/MobileNavigation';
import { Dashboard } from '@/components/Dashboard/Dashboard';
import { GoalManager } from '@/components/Goals/GoalManager';
import { Schedule } from '@/components/Schedule/Schedule';
import { TaskManager } from '@/components/Tasks/TaskManager';
import { Analytics } from '@/components/Analytics/Analytics';
import { Settings } from '@/components/Settings/Settings';
import { Goal, ScheduleActivity, Task, Achievement, ScheduleTemplate, DailyRating, SubTask } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { generateId } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { mapBackendGoalToFrontend, mapFrontendGoalToBackend, mapFrontendGoalUpdateToBackend } from '@/lib/goalMapper';
import { mapBackendTaskToFrontend, mapFrontendTaskToBackend, mapFrontendTaskUpdateToBackend } from '@/lib/taskMapper';
import { mapBackendScheduleToFrontend, mapFrontendActivityToBackend, mapFrontendActivityUpdateToBackend } from '@/lib/scheduleMapper';

export default function Home() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const deviceInfo = useDeviceDetection();
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // API-backed state
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activities, setActivities] = useState<ScheduleActivity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Local-only state (no backend models)
  const [achievements] = useLocalStorage<Achievement[]>('dev-tracker-achievements', []);
  const [scheduleTemplates, setScheduleTemplates] = useLocalStorage<ScheduleTemplate[]>('dev-tracker-templates', []);
  const [dailyRatings, setDailyRatings] = useLocalStorage<DailyRating[]>('dev-tracker-ratings', []);

  const fetchAllData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsDataLoading(true);
    try {
      const [goalsRes, tasksRes, schedulesRes] = await Promise.all([
        apiClient.getGoals(),
        apiClient.getTasks(),
        apiClient.getSchedules(),
      ]);

      const fetchedActivities: ScheduleActivity[] = schedulesRes.success && schedulesRes.data?.schedules
        ? schedulesRes.data.schedules.map(mapBackendScheduleToFrontend)
        : [];

      setActivities(fetchedActivities);

      if (tasksRes.success && tasksRes.data?.tasks) {
        setTasks(tasksRes.data.tasks.map(mapBackendTaskToFrontend));
      }

      if (goalsRes.success && goalsRes.data?.goals) {
        setGoals(goalsRes.data.goals.map(g => mapBackendGoalToFrontend(g, fetchedActivities)));
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsDataLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      fetchAllData();
    }
  }, [isAuthenticated, isLoading, fetchAllData]);

  if (isLoading || (isAuthenticated && isDataLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Goal handlers
  const handleCreateGoal = async (goalData: Omit<Goal, 'id' | 'createdAt' | 'currentWeeklyHours' | 'streakDays' | 'status' | 'progress'>) => {
    const backendData = mapFrontendGoalToBackend(goalData);
    const response = await apiClient.createGoal(backendData);
    if (response.success && response.data?.goal) {
      const newGoal = mapBackendGoalToFrontend(response.data.goal, activities);
      setGoals(prev => [...prev, newGoal]);
    } else {
      throw new Error(response.error || 'Failed to create goal');
    }
  };

  const handleUpdateGoal = async (goalId: string, updates: Partial<Goal>) => {
    const backendUpdates = mapFrontendGoalUpdateToBackend(updates);
    const response = await apiClient.updateGoal(goalId, backendUpdates);
    if (response.success && response.data?.goal) {
      const updatedGoal = mapBackendGoalToFrontend(response.data.goal, activities);
      setGoals(prev => prev.map(g => g.id === goalId ? updatedGoal : g));
    } else {
      throw new Error(response.error || 'Failed to update goal');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    const response = await apiClient.deleteGoal(goalId);
    if (response.success) {
      setGoals(prev => prev.filter(g => g.id !== goalId));
      setActivities(prev => prev.filter(a => a.goalId !== goalId));
      setTasks(prev => prev.filter(t => t.goalId !== goalId));
    } else {
      throw new Error(response.error || 'Failed to delete goal');
    }
  };

  // Activity handlers
  const handleActivityStatusChange = async (activityId: string, status: ScheduleActivity['status']) => {
    try {
      const response = await apiClient.updateSchedule(activityId, { status: { pending: 'PENDING', 'in-progress': 'IN_PROGRESS', completed: 'COMPLETED', skipped: 'SKIPPED', rescheduled: 'RESCHEDULED' }[status] });
      if (response.success && response.data?.schedule) {
        const updated = mapBackendScheduleToFrontend(response.data.schedule);
        setActivities(prev => prev.map(a => a.id === activityId ? updated : a));
        setGoals(prev => prev.map(g => mapBackendGoalToFrontend(
          { id: g.id, title: g.name, description: JSON.stringify({ color: g.color, targetHoursWeekly: g.targetHoursWeekly, targetHoursDaily: g.targetHoursDaily }), priority: (['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const)[g.priority - 1] || 'MEDIUM', status: g.status, progress: g.progress, createdAt: g.createdAt, updatedAt: g.createdAt },
          activities.map(a => a.id === activityId ? updated : a)
        )));
      }
    } catch (error) {
      console.error('Failed to update activity status:', error);
    }
  };

  const handleCreateActivity = async (activityData: Omit<ScheduleActivity, 'id'>) => {
    try {
      const backendData = mapFrontendActivityToBackend(activityData);
      const response = await apiClient.createSchedule(backendData);
      if (response.success && response.data?.schedule) {
        const newActivity = mapBackendScheduleToFrontend(response.data.schedule);
        setActivities(prev => [...prev, newActivity]);
      }
    } catch (error) {
      console.error('Failed to create activity:', error);
    }
  };

  const handleUpdateActivity = async (activityId: string, updates: Partial<ScheduleActivity>) => {
    try {
      const current = activities.find(a => a.id === activityId);
      const backendUpdates = mapFrontendActivityUpdateToBackend(updates, current?.date);
      const response = await apiClient.updateSchedule(activityId, backendUpdates);
      if (response.success && response.data?.schedule) {
        const updated = mapBackendScheduleToFrontend(response.data.schedule);
        setActivities(prev => prev.map(a => a.id === activityId ? updated : a));
      }
    } catch (error) {
      console.error('Failed to update activity:', error);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    try {
      const response = await apiClient.deleteSchedule(activityId);
      if (response.success) {
        setActivities(prev => prev.filter(a => a.id !== activityId));
      }
    } catch (error) {
      console.error('Failed to delete activity:', error);
    }
  };

  // Template handlers (local only)
  const handleCreateTemplate = (templateData: Omit<ScheduleTemplate, 'id'>) => {
    setScheduleTemplates(prev => [...prev, { ...templateData, id: generateId() }]);
  };

  const handleUpdateTemplate = (templateId: string, updates: Partial<ScheduleTemplate>) => {
    setScheduleTemplates(prev => prev.map(t => t.id === templateId ? { ...t, ...updates } : t));
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm('Delete this template?')) {
      setScheduleTemplates(prev => prev.filter(t => t.id !== templateId));
    }
  };

  // Task handlers
  const handleCreateTask = async (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    try {
      const backendData = mapFrontendTaskToBackend(taskData);
      const response = await apiClient.createTask(backendData);
      if (response.success && response.data?.task) {
        const newTask = mapBackendTaskToFrontend(response.data.task);
        newTask.subtasks = taskData.subtasks ?? [];
        setTasks(prev => [newTask, ...prev]);
      }
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const backendUpdates = mapFrontendTaskUpdateToBackend(updates);
      const response = await apiClient.updateTask(taskId, backendUpdates);
      if (response.success && response.data?.task) {
        const updatedTask = mapBackendTaskToFrontend(response.data.task);
        setTasks(prev => prev.map(t => {
          if (t.id !== taskId) return t;
          return { ...updatedTask, subtasks: updates.subtasks ?? t.subtasks };
        }));
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await apiClient.deleteTask(taskId);
      if (response.success) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleUpdateSubTask = (taskId: string, subTaskId: string, updates: Partial<SubTask>) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId
        ? { ...task, subtasks: task.subtasks.map(st => st.id === subTaskId ? { ...st, ...updates } : st) }
        : task
    ));
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            goals={goals}
            activities={activities}
            achievements={achievements}
            onGoalClick={() => setCurrentView('analytics')}
            onActivityStatusChange={handleActivityStatusChange}
            onViewChange={setCurrentView}
            isMobile={deviceInfo.isMobile}
          />
        );
      case 'goals':
        return (
          <GoalManager
            goals={goals}
            onCreateGoal={handleCreateGoal}
            onUpdateGoal={handleUpdateGoal}
            onDeleteGoal={handleDeleteGoal}
            isMobile={deviceInfo.isMobile}
            isLoading={isDataLoading}
          />
        );
      case 'schedule':
        return (
          <Schedule
            goals={goals}
            activities={activities}
            scheduleTemplates={scheduleTemplates}
            onActivityStatusChange={handleActivityStatusChange}
            onCreateActivity={handleCreateActivity}
            onUpdateActivity={handleUpdateActivity}
            onDeleteActivity={handleDeleteActivity}
            onCreateTemplate={handleCreateTemplate}
            onUpdateTemplate={handleUpdateTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            isMobile={deviceInfo.isMobile}
          />
        );
      case 'tasks':
        return (
          <TaskManager
            goals={goals}
            tasks={tasks}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onUpdateSubTask={handleUpdateSubTask}
            isMobile={deviceInfo.isMobile}
          />
        );
      case 'analytics':
        return (
          <Analytics
            goals={goals}
            activities={activities}
            tasks={tasks}
            achievements={achievements}
            dailyRatings={dailyRatings}
            isMobile={deviceInfo.isMobile}
          />
        );
      case 'settings':
        return (
          <Settings
            isDarkMode={isDarkMode}
            onThemeToggle={() => setIsDarkMode(d => !d)}
            isMobile={deviceInfo.isMobile}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        isDarkMode={isDarkMode}
        onThemeToggle={() => setIsDarkMode(d => !d)}
        isMobile={deviceInfo.isMobile}
      />
      <main className="px-4 md:px-6 py-4 md:py-6 pb-20 md:pb-6">
        {renderCurrentView()}
      </main>
      {deviceInfo.isMobile && (
        <MobileNavigation currentView={currentView} onViewChange={setCurrentView} />
      )}
    </div>
  );
}
