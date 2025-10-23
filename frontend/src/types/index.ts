// Core type definitions for the personal development tracker app

export interface Goal {
  id: string;
  name: string;
  color: string;
  category: 'high' | 'medium' | 'low';
  targetHoursWeekly: number;
  targetHoursDaily: number;
  currentWeeklyHours: number;
  streakDays: number;
  createdAt: string;
  priority: number;
}

export interface ScheduleActivity {
  id: string;
  goalId: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  status: 'pending' | 'completed' | 'in-progress' | 'skipped' | 'rescheduled';
  notes?: string;
  actualTimeSpent?: number;
}

export interface Task {
  id: string;
  goalId: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'in-progress' | 'completed';
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
  subtasks: SubTask[];
  tags: string[];
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TimeLog {
  id: string;
  goalId: string;
  activityId?: string;
  title: string;
  duration: number;
  date: string;
  notes?: string;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  type: 'workday' | 'weekend' | 'busy' | 'low-energy' | 'travel';
  activities: Omit<ScheduleActivity, 'id' | 'date' | 'status'>[];
}

export interface DailyRating {
  date: string;
  performance: number;
  energy: number;
  mood: number;
  notes?: string;
}

export interface Achievement {
  id: string;
  goalId?: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  criteria: {
    type: 'streak' | 'hours' | 'tasks' | 'consistency';
    target: number;
    current: number;
  };
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  autoSave: boolean;
  workingHours: {
    start: string;
    end: string;
  };
  pomodoroSettings: {
    workDuration: number;
    breakDuration: number;
    longBreakDuration: number;
    cyclesBeforeLongBreak: number;
  };
}

export interface WeeklyStats {
  week: string;
  totalHours: number;
  plannedHours: number;
  completionRate: number;
  goalStats: Array<{
    goalId: string;
    hours: number;
    target: number;
    completionRate: number;
  }>;
}

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
}