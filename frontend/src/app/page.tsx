'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Layout/Header';
import { MobileNavigation } from '@/components/Layout/MobileNavigation';
import { Dashboard } from '@/components/Dashboard/Dashboard';
import { GoalManager } from '@/components/Goals/GoalManager';
import { Schedule } from '@/components/Schedule/Schedule';
import { TaskManager } from '@/components/Tasks/TaskManager';
import { Analytics } from '@/components/Analytics/Analytics';
import { Goal, ScheduleActivity, Task, Achievement, ScheduleTemplate, DailyRating, SubTask } from '@/types';
import { sampleGoals, sampleTasks, sampleAchievements, sampleScheduleTemplates, sampleDailyRatings, getCurrentWeekActivities } from '@/data/sampleData';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { generateId } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const deviceInfo = useDeviceDetection();
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect to auth page if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth page if not authenticated
  if (!isAuthenticated) {
    return null; // Will redirect to /auth
  }

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  // Data state with sample data
  const [goals, setGoals] = useLocalStorage<Goal[]>('dev-tracker-goals', sampleGoals);
  const [activities, setActivities] = useLocalStorage<ScheduleActivity[]>('dev-tracker-activities', getCurrentWeekActivities());
  const [tasks, setTasks] = useLocalStorage<Task[]>('dev-tracker-tasks', sampleTasks);
  const [achievements, setAchievements] = useLocalStorage<Achievement[]>('dev-tracker-achievements', sampleAchievements);
  const [scheduleTemplates, setScheduleTemplates] = useLocalStorage<ScheduleTemplate[]>('dev-tracker-templates', sampleScheduleTemplates);
  const [dailyRatings, setDailyRatings] = useLocalStorage<DailyRating[]>('dev-tracker-ratings', sampleDailyRatings);

  // Apply dark mode class to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleThemeToggle = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Goal management functions
  const handleCreateGoal = (goalData: Omit<Goal, 'id' | 'createdAt' | 'currentWeeklyHours' | 'streakDays'>) => {
    const newGoal: Goal = {
      ...goalData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      currentWeeklyHours: 0,
      streakDays: 0
    };
    setGoals([...goals, newGoal]);
  };

  const handleUpdateGoal = (goalId: string, updates: Partial<Goal>) => {
    setGoals(goals.map(goal => 
      goal.id === goalId ? { ...goal, ...updates } : goal
    ));
  };

  const handleDeleteGoal = (goalId: string) => {
    setGoals(goals.filter(goal => goal.id !== goalId));
    setActivities(activities.filter(activity => activity.goalId !== goalId));
    setTasks(tasks.filter(task => task.goalId !== goalId));
  };

  // Activity management functions
  const handleActivityStatusChange = (activityId: string, status: ScheduleActivity['status']) => {
    setActivities(activities.map(activity => 
      activity.id === activityId ? { ...activity, status } : activity
    ));

    // Update goal progress when activity is completed
    if (status === 'completed') {
      const activity = activities.find(a => a.id === activityId);
      if (activity) {
        const startTime = new Date(`2000-01-01T${activity.startTime}`);
        const endTime = new Date(`2000-01-01T${activity.endTime}`);
        const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        
        setGoals(goals.map(goal => 
          goal.id === activity.goalId 
            ? { ...goal, currentWeeklyHours: goal.currentWeeklyHours + durationHours }
            : goal
        ));
      }
    }
  };

  const handleCreateActivity = (activityData: Omit<ScheduleActivity, 'id'>) => {
    const newActivity: ScheduleActivity = {
      ...activityData,
      id: generateId(),
      status: activityData.status || 'pending'
    };
    setActivities([...activities, newActivity]);
  };

  const handleUpdateActivity = (activityId: string, updates: Partial<ScheduleActivity>) => {
    setActivities(activities.map(activity => 
      activity.id === activityId ? { ...activity, ...updates } : activity
    ));
  };

  const handleDeleteActivity = (activityId: string) => {
    setActivities(activities.filter(activity => activity.id !== activityId));
  };

  // Template management functions
  const handleCreateTemplate = (templateData: Omit<ScheduleTemplate, 'id'>) => {
    const newTemplate: ScheduleTemplate = {
      ...templateData,
      id: generateId()
    };
    setScheduleTemplates([...scheduleTemplates, newTemplate]);
  };

  const handleUpdateTemplate = (templateId: string, updates: Partial<ScheduleTemplate>) => {
    setScheduleTemplates(scheduleTemplates.map(template => 
      template.id === templateId ? { ...template, ...updates } : template
    ));
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      setScheduleTemplates(scheduleTemplates.filter(template => template.id !== templateId));
    }
  };

  // Task management functions
  const handleCreateTask = (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      completedAt: taskData.status === 'completed' ? new Date().toISOString() : undefined
    };
    setTasks([...tasks, newTask]);
  };

  const handleUpdateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        const updatedTask = { ...task, ...updates };
        // Update completedAt if status changes to completed
        if (updates.status === 'completed' && !task.completedAt) {
          updatedTask.completedAt = new Date().toISOString();
        } else if (updates.status !== 'completed' && task.completedAt) {
          updatedTask.completedAt = undefined;
        }
        return updatedTask;
      }
      return task;
    }));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(task => task.id !== taskId));
  };

  const handleUpdateSubTask = (taskId: string, subTaskId: string, updates: Partial<SubTask>) => {
    setTasks(tasks.map(task => 
      task.id === taskId 
        ? {
            ...task,
            subtasks: task.subtasks.map(subTask => 
              subTask.id === subTaskId ? { ...subTask, ...updates } : subTask
            )
          }
        : task
    ));
  };

  const handleGoalClick = (goalId: string) => {
    // Navigate to goal details or analytics view
    setCurrentView('analytics');
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            goals={goals}
            activities={activities}
            achievements={achievements}
            onGoalClick={handleGoalClick}
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
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Settings</h2>
            <p className="text-gray-500 dark:text-gray-400">Coming soon! App settings and configuration options will be available here.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'
    }`}>
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        isDarkMode={isDarkMode}
        onThemeToggle={handleThemeToggle}
        isMobile={deviceInfo.isMobile}
      />
      
      <main className="px-4 md:px-6 py-4 md:py-6">
        {renderCurrentView()}
      </main>

      {/* Mobile Navigation */}
      {deviceInfo.isMobile && (
        <MobileNavigation
          currentView={currentView}
          onViewChange={setCurrentView}
        />
      )}
    </div>
  );
}