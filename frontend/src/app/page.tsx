'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Layout/Header';
import { MobileNavigation } from '@/components/Layout/MobileNavigation';
import { GoalManager } from '@/components/Goals/GoalManager';
import { Schedule } from '@/components/Schedule/Schedule';
import { TaskManager } from '@/components/Tasks/TaskManager';
import { Analytics } from '@/components/Analytics/Analytics';
import { Settings } from '@/components/Settings/Settings';
import { HabitTracker } from '@/components/Habits/HabitTracker';
import { FocusTimer } from '@/components/Focus/FocusTimer';
import { TodayView } from '@/components/Today/TodayView';
import { QuickCapture } from '@/components/ui/QuickCapture';
import { Goal, GoalInput, ScheduleActivity, Task, ScheduleTemplate, DailyRating, SubTask, Habit, FocusSession } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { generateId } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { applyGoalStats, mapBackendGoalToFrontend, mapGoalInputToBackend, mapGoalUpdateToBackend } from '@/lib/goalMapper';
import { mapBackendReflectionToRating, mapRatingToReflectionPayload } from '@/lib/reflectionMapper';
import { mapBackendFocusSession } from '@/lib/focusMapper';
import { RecordedFocus } from '@/hooks/useTimer';
import { mapBackendTaskToFrontend, mapFrontendTaskToBackend, mapFrontendTaskUpdateToBackend } from '@/lib/taskMapper';
import { mapBackendScheduleToFrontend, mapFrontendActivityToBackend, mapFrontendActivityUpdateToBackend } from '@/lib/scheduleMapper';
import { mapBackendHabitToFrontend } from '@/lib/habitMapper';
import { toDateKey } from '@/lib/dates';

const LEGACY_RATINGS_KEY = 'dev-tracker-ratings';

// Earlier versions kept daily reviews only in localStorage. Upload them once;
// the server never overwrites an existing day, and the local copy is removed
// only after the upload succeeds. Returns true if anything was uploaded.
async function importLegacyRatings(): Promise<boolean> {
  let legacy: DailyRating[];
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_RATINGS_KEY) ?? '[]');
  } catch {
    return false;
  }
  if (!Array.isArray(legacy) || legacy.length === 0) return false;
  try {
    const valid = legacy.filter(r => typeof r?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
    await apiClient.importReflections(valid.map(r => ({ date: r.date, ...mapRatingToReflectionPayload(r) })));
    localStorage.removeItem(LEGACY_RATINGS_KEY);
    return valid.length > 0;
  } catch (error) {
    console.error('Importing locally stored reviews failed; will retry next load:', error);
    return false;
  }
}

export default function Home() {
  const [currentView, setCurrentView] = useState('today');
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
  const [habits, setHabits] = useState<Habit[]>([]);
  const [dailyRatings, setDailyRatings] = useState<DailyRating[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Local-only state
  const [scheduleTemplates, setScheduleTemplates] = useLocalStorage<ScheduleTemplate[]>('dev-tracker-templates', []);

  // Weekly hours and streaks are derived, so they stay correct whenever
  // schedule blocks or focus sessions change.
  const goalsWithStats = useMemo(
    () => goals.map(goal => applyGoalStats(goal, activities, focusSessions)),
    [goals, activities, focusSessions]
  );

  const today = toDateKey();
  const todayRating = dailyRatings.find(r => r.date === today) ?? null;

  const fetchAllData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsDataLoading(true);
    try {
      const [goalsResult, tasksResult, schedulesResult, habitsResult, reflectionsResult, focusResult] = await Promise.allSettled([
        apiClient.getGoals(),
        apiClient.getTasks(),
        apiClient.getSchedules(),
        apiClient.getHabits(),
        apiClient.getReflections(),
        apiClient.getFocusSessions(),
      ]);

      if (reflectionsResult.status === 'fulfilled' && reflectionsResult.value.data?.reflections) {
        const imported = await importLegacyRatings();
        const reflections = imported
          ? (await apiClient.getReflections()).data?.reflections ?? []
          : reflectionsResult.value.data.reflections;
        setDailyRatings(reflections.map(mapBackendReflectionToRating));
      }

      if (focusResult.status === 'fulfilled' && focusResult.value.data?.sessions) {
        setFocusSessions(focusResult.value.data.sessions.map(mapBackendFocusSession));
      }

      const schedulesRes = schedulesResult.status === 'fulfilled' ? schedulesResult.value : null;
      const fetchedActivities: ScheduleActivity[] = schedulesRes?.success && schedulesRes.data?.schedules
        ? schedulesRes.data.schedules.map(mapBackendScheduleToFrontend)
        : [];
      setActivities(fetchedActivities);

      const tasksRes = tasksResult.status === 'fulfilled' ? tasksResult.value : null;
      if (tasksRes?.success && tasksRes.data?.tasks) {
        setTasks(tasksRes.data.tasks.map(mapBackendTaskToFrontend));
      }

      const goalsRes = goalsResult.status === 'fulfilled' ? goalsResult.value : null;
      if (goalsRes?.success && goalsRes.data?.goals) {
        setGoals(goalsRes.data.goals.map(mapBackendGoalToFrontend));
      }

      const habitsRes = habitsResult.status === 'fulfilled' ? habitsResult.value : null;
      if (habitsRes?.success && habitsRes.data?.habits) {
        const habitDetails = await Promise.allSettled(
          habitsRes.data.habits.map(h => apiClient.getHabitWithCompletions(h.id))
        );
        const mappedHabits = habitDetails
          .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof apiClient.getHabitWithCompletions>>> =>
            r.status === 'fulfilled'
          )
          .map(r => r.value)
          .filter(r => r.success && r.data?.habit)
          .map(r => mapBackendHabitToFrontend(r.data!.habit));
        setHabits(mappedHabits);
      }

      if (goalsResult.status === 'rejected') console.error('Goals fetch failed:', goalsResult.reason);
      if (tasksResult.status === 'rejected') console.error('Tasks fetch failed:', tasksResult.reason);
      if (schedulesResult.status === 'rejected') console.error('Schedules fetch failed:', schedulesResult.reason);
      if (habitsResult.status === 'rejected') console.error('Habits fetch failed:', habitsResult.reason);
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

  // ─── Goal handlers ───────────────────────────────────────────────────────────
  const handleCreateGoal = async (goalData: GoalInput) => {
    const response = await apiClient.createGoal(mapGoalInputToBackend(goalData));
    if (response.success && response.data?.goal) {
      const newGoal = mapBackendGoalToFrontend(response.data.goal);
      setGoals(prev => [...prev, newGoal]);
    } else {
      throw new Error(response.error || 'Failed to create goal');
    }
  };

  const handleUpdateGoal = async (goalId: string, updates: Partial<GoalInput>) => {
    const response = await apiClient.updateGoal(goalId, mapGoalUpdateToBackend(updates));
    if (response.success && response.data?.goal) {
      replaceGoal(mapBackendGoalToFrontend(response.data.goal));
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

  const replaceGoal = (goal: Goal) => setGoals(prev => prev.map(g => (g.id === goal.id ? goal : g)));

  // ─── Milestone handlers (responses carry the goal, whose progress they drive) ─
  const handleAddMilestone = async (goalId: string, title: string) => {
    const response = await apiClient.createMilestone(goalId, { title });
    if (response.data?.goal) replaceGoal(mapBackendGoalToFrontend(response.data.goal));
  };

  const handleToggleMilestone = async (milestoneId: string, completed: boolean) => {
    const response = await apiClient.updateMilestone(milestoneId, { completed });
    if (response.data?.goal) replaceGoal(mapBackendGoalToFrontend(response.data.goal));
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    const response = await apiClient.deleteMilestone(milestoneId);
    if (response.data?.goal) replaceGoal(mapBackendGoalToFrontend(response.data.goal));
  };

  // ─── Activity handlers ────────────────────────────────────────────────────────
  const statusBackendMap: Record<ScheduleActivity['status'], string> = {
    pending: 'PENDING',
    'in-progress': 'IN_PROGRESS',
    completed: 'COMPLETED',
    skipped: 'SKIPPED',
    rescheduled: 'RESCHEDULED',
  };

  const handleActivityStatusChange = async (activityId: string, status: ScheduleActivity['status']) => {
    try {
      const response = await apiClient.updateSchedule(activityId, { status: statusBackendMap[status] });
      if (response.success && response.data?.schedule) {
        const updated = mapBackendScheduleToFrontend(response.data.schedule);
        setActivities(prev => prev.map(a => a.id === activityId ? updated : a));
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

  // ─── Template handlers (local only) ─────────────────────────────────────────
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

  // ─── Task handlers ────────────────────────────────────────────────────────────
  const handleCreateTask = async (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    try {
      const backendData = mapFrontendTaskToBackend(taskData);
      const response = await apiClient.createTask(backendData);
      if (response.success && response.data?.task) {
        setTasks(prev => [mapBackendTaskToFrontend(response.data!.task), ...prev]);
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
        setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
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

  const handleUpdateSubTask = async (taskId: string, subTaskId: string, updates: Partial<SubTask>) => {
    const patchSubtask = (patch: Partial<SubTask>) => setTasks(prev => prev.map(task =>
      task.id === taskId
        ? { ...task, subtasks: task.subtasks.map(st => st.id === subTaskId ? { ...st, ...patch } : st) }
        : task
    ));
    const previous = tasks.find(t => t.id === taskId)?.subtasks.find(st => st.id === subTaskId);
    patchSubtask(updates); // optimistic
    try {
      await apiClient.updateSubtask(taskId, subTaskId, { title: updates.title, completed: updates.completed });
    } catch (error) {
      console.error('Failed to update subtask:', error);
      if (previous) patchSubtask(previous); // roll back
    }
  };

  // Quick capture task
  const handleQuickTask = async (data: { title: string; priority: string; goalId?: string }) => {
    await handleCreateTask({
      title: data.title,
      priority: data.priority as Task['priority'],
      status: 'todo',
      tags: [],
      subtasks: [],
      goalId: data.goalId,
    });
  };

  // Quick capture activity
  const handleQuickActivity = async (data: { title: string; date: string; startTime: string; endTime: string; goalId?: string }) => {
    await handleCreateActivity({
      title: data.title,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      status: 'pending',
      goalId: data.goalId,
    });
  };

  // Bulk create for recurring schedules
  const handleCreateActivities = async (activitiesList: Array<Omit<ScheduleActivity, 'id'>>) => {
    for (const a of activitiesList) {
      await handleCreateActivity(a);
    }
  };

  // ─── Habit handlers ───────────────────────────────────────────────────────────
  const handleCreateHabit = async (data: { name: string; description?: string; frequency: string; targetCount: number }) => {
    const response = await apiClient.createHabit({ ...data, frequency: data.frequency.toUpperCase() });
    if (response.success && response.data?.habit) {
      const fullRes = await apiClient.getHabitWithCompletions(response.data.habit.id);
      if (fullRes.success && fullRes.data?.habit) {
        setHabits(prev => [...prev, mapBackendHabitToFrontend(fullRes.data!.habit)]);
      }
    }
  };

  const handleUpdateHabit = async (id: string, data: { name?: string; description?: string; frequency?: string; targetCount?: number }) => {
    const payload = { ...data, ...(data.frequency ? { frequency: data.frequency.toUpperCase() } : {}) };
    const response = await apiClient.updateHabit(id, payload);
    if (response.success) {
      const fullRes = await apiClient.getHabitWithCompletions(id);
      if (fullRes.success && fullRes.data?.habit) {
        setHabits(prev => prev.map(h => h.id === id ? mapBackendHabitToFrontend(fullRes.data!.habit) : h));
      }
    }
  };

  const handleDeleteHabit = async (id: string) => {
    const response = await apiClient.deleteHabit(id);
    if (response.success) {
      setHabits(prev => prev.filter(h => h.id !== id));
    }
  };

  const handleCompleteHabit = async (id: string, date: string) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    if (habit.completedToday) return; // already done
    await apiClient.completeHabit(id, { date });
    const fullRes = await apiClient.getHabitWithCompletions(id);
    if (fullRes.success && fullRes.data?.habit) {
      setHabits(prev => prev.map(h => h.id === id ? mapBackendHabitToFrontend(fullRes.data!.habit) : h));
    }
  };

  // ─── Daily rating handler ─────────────────────────────────────────────────────
  const handleSaveDailyRating = async (rating: Omit<DailyRating, 'date'>) => {
    const response = await apiClient.saveReflection(today, mapRatingToReflectionPayload(rating));
    if (response.data?.reflection) {
      const saved = mapBackendReflectionToRating(response.data.reflection);
      setDailyRatings(prev => [...prev.filter(r => r.date !== saved.date), saved]);
    }
  };

  // ─── Focus sessions ───────────────────────────────────────────────────────────
  const handleRecordFocus = async (focus: RecordedFocus & { goalId?: string; taskId?: string }) => {
    const response = await apiClient.createFocusSession({
      startedAt: focus.startedAt.toISOString(),
      endedAt: focus.endedAt.toISOString(),
      durationSeconds: focus.durationSeconds,
      plannedSeconds: focus.plannedSeconds,
      completed: focus.completed,
      goalId: focus.goalId,
      taskId: focus.taskId,
    });
    if (response.data?.session) {
      setFocusSessions(prev => [...prev, mapBackendFocusSession(response.data!.session)]);
    }
  };

  // ─── View renderer ────────────────────────────────────────────────────────────
  const renderCurrentView = () => {
    switch (currentView) {
      case 'today':
        return (
          <TodayView
            goals={goalsWithStats}
            activities={activities}
            tasks={tasks}
            habits={habits}
            dailyRating={todayRating}
            onActivityStatusChange={handleActivityStatusChange}
            onTaskStatusChange={(id, status) => handleUpdateTask(id, { status })}
            onCompleteHabit={handleCompleteHabit}
            onSaveDailyRating={handleSaveDailyRating}
            onViewChange={setCurrentView}
            isMobile={deviceInfo.isMobile}
          />
        );
      case 'goals':
        return (
          <GoalManager
            goals={goalsWithStats}
            onCreateGoal={handleCreateGoal}
            onUpdateGoal={handleUpdateGoal}
            onDeleteGoal={handleDeleteGoal}
            onAddMilestone={handleAddMilestone}
            onToggleMilestone={handleToggleMilestone}
            onDeleteMilestone={handleDeleteMilestone}
            isMobile={deviceInfo.isMobile}
            isLoading={isDataLoading}
          />
        );
      case 'habits':
        return (
          <HabitTracker
            habits={habits}
            onCreateHabit={handleCreateHabit}
            onUpdateHabit={handleUpdateHabit}
            onDeleteHabit={handleDeleteHabit}
            onCompleteHabit={handleCompleteHabit}
            isMobile={deviceInfo.isMobile}
          />
        );
      case 'focus':
        return (
          <FocusTimer
            goals={goalsWithStats}
            tasks={tasks}
            focusSessions={focusSessions}
            onRecordFocus={handleRecordFocus}
            isMobile={deviceInfo.isMobile}
          />
        );
      case 'schedule':
        return (
          <Schedule
            goals={goalsWithStats}
            tasks={tasks}
            activities={activities}
            scheduleTemplates={scheduleTemplates}
            onActivityStatusChange={handleActivityStatusChange}
            onCreateActivity={handleCreateActivity}
            onCreateActivities={handleCreateActivities}
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
            goals={goalsWithStats}
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
            goals={goalsWithStats}
            activities={activities}
            tasks={tasks}
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
      <QuickCapture
        goals={goalsWithStats}
        onCreateTask={handleQuickTask}
        onCreateActivity={handleQuickActivity}
      />
    </div>
  );
}
