import { Goal, ScheduleActivity, Task, Achievement, ScheduleTemplate, DailyRating } from '@/types';

export const sampleGoals: Goal[] = [
  {
    id: 'goal-1',
    name: 'Programming & Development',
    color: '#3B82F6',
    category: 'high',
    targetHoursWeekly: 20,
    targetHoursDaily: 3,
    currentWeeklyHours: 16.5,
    streakDays: 12,
    createdAt: '2025-01-01T00:00:00Z',
    priority: 1
  },
  {
    id: 'goal-2', 
    name: 'Health & Fitness',
    color: '#10B981',
    category: 'high',
    targetHoursWeekly: 10,
    targetHoursDaily: 1.5,
    currentWeeklyHours: 8.5,
    streakDays: 8,
    createdAt: '2025-01-01T00:00:00Z',
    priority: 2
  },
  {
    id: 'goal-3',
    name: 'Language Learning',
    color: '#8B5CF6',
    category: 'medium',
    targetHoursWeekly: 7,
    targetHoursDaily: 1,
    currentWeeklyHours: 6.5,
    streakDays: 15,
    createdAt: '2025-01-01T00:00:00Z',
    priority: 3
  },
  {
    id: 'goal-4',
    name: 'Reading & Research',
    color: '#F97316',
    category: 'medium',
    targetHoursWeekly: 8,
    targetHoursDaily: 1.2,
    currentWeeklyHours: 5.0,
    streakDays: 3,
    createdAt: '2025-01-01T00:00:00Z',
    priority: 4
  }
];

export const sampleTasks: Task[] = [
  {
    id: 'task-1',
    goalId: 'goal-1',
    title: 'Complete React Advanced Hooks Course',
    description: 'Finish modules 5-8 and build the final project',
    priority: 'high',
    status: 'in-progress',
    dueDate: '2025-01-15',
    createdAt: '2025-01-01T00:00:00Z',
    subtasks: [
      { id: 'sub-1', title: 'Module 5: useContext', completed: true },
      { id: 'sub-2', title: 'Module 6: useReducer', completed: true },
      { id: 'sub-3', title: 'Module 7: Custom Hooks', completed: false },
      { id: 'sub-4', title: 'Module 8: Performance', completed: false }
    ],
    tags: ['course', 'react', 'javascript']
  },
  {
    id: 'task-2',
    goalId: 'goal-2',
    title: 'Plan Weekly Workout Routine',
    description: 'Create a balanced schedule with strength training and cardio',
    priority: 'medium',
    status: 'todo',
    dueDate: '2025-01-10',
    createdAt: '2025-01-05T00:00:00Z',
    subtasks: [
      { id: 'sub-5', title: 'Research exercise routines', completed: false },
      { id: 'sub-6', title: 'Schedule gym sessions', completed: false }
    ],
    tags: ['planning', 'fitness']
  },
  {
    id: 'task-3',
    goalId: 'goal-3',
    title: 'Spanish Conversation Practice',
    description: 'Schedule weekly sessions with language exchange partner',
    priority: 'high',
    status: 'completed',
    dueDate: '2025-01-08',
    createdAt: '2025-01-02T00:00:00Z',
    completedAt: '2025-01-07T00:00:00Z',
    subtasks: [],
    tags: ['spanish', 'conversation']
  }
];

export const sampleScheduleTemplates: ScheduleTemplate[] = [
  {
    id: 'template-workday',
    name: 'Productive Workday',
    type: 'workday',
    activities: [
      {
        goalId: 'goal-1',
        title: 'Morning Coding Session',
        startTime: '07:00',
        endTime: '09:00'
      },
      {
        goalId: 'goal-2',
        title: 'Gym Workout',
        startTime: '18:00',
        endTime: '19:30'
      },
      {
        goalId: 'goal-3',
        title: 'Spanish Practice',
        startTime: '20:00',
        endTime: '21:00'
      }
    ]
  },
  {
    id: 'template-weekend',
    name: 'Weekend Focus',
    type: 'weekend',
    activities: [
      {
        goalId: 'goal-4',
        title: 'Deep Reading Session',
        startTime: '09:00',
        endTime: '11:00'
      },
      {
        goalId: 'goal-1',
        title: 'Side Project Development',
        startTime: '14:00',
        endTime: '17:00'
      },
      {
        goalId: 'goal-2',
        title: 'Outdoor Activity',
        startTime: '10:00',
        endTime: '12:00'
      }
    ]
  }
];

export const sampleAchievements: Achievement[] = [
  {
    id: 'achievement-1',
    goalId: 'goal-3',
    title: 'Language Streak Master',
    description: 'Maintained a 15-day Spanish learning streak',
    icon: 'flame',
    unlockedAt: '2025-01-08T00:00:00Z',
    criteria: {
      type: 'streak',
      target: 15,
      current: 15
    }
  },
  {
    id: 'achievement-2',
    goalId: 'goal-1',
    title: 'Code Warrior',
    description: 'Complete 10 hours of programming this week',
    icon: 'code',
    criteria: {
      type: 'hours',
      target: 10,
      current: 8.5
    }
  }
];

export const sampleDailyRatings: DailyRating[] = [
  {
    date: '2025-01-07',
    performance: 4,
    energy: 4,
    mood: 5,
    notes: 'Great productive day! Completed all planned activities.'
  },
  {
    date: '2025-01-06',
    performance: 3,
    energy: 3,
    mood: 3,
    notes: 'Average day, struggled with focus in the afternoon.'
  },
  {
    date: '2025-01-05',
    performance: 5,
    energy: 5,
    mood: 4,
    notes: 'Exceptional day! Felt energized and accomplished a lot.'
  }
];

export const getCurrentWeekActivities = (): ScheduleActivity[] => {
  const activities: ScheduleActivity[] = [];
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    // Add some sample activities
    if (i < 5) { // Weekdays
      activities.push({
        id: `activity-${i}-1`,
        goalId: 'goal-1',
        title: 'Morning Coding',
        startTime: '07:00',
        endTime: '09:00',
        date: dateStr,
        status: i < 3 ? 'completed' : 'pending'
      });

      activities.push({
        id: `activity-${i}-2`,
        goalId: 'goal-2',
        title: 'Evening Workout',
        startTime: '18:00',
        endTime: '19:30',
        date: dateStr,
        status: i < 2 ? 'completed' : i === 2 ? 'in-progress' : 'pending'
      });
    } else { // Weekends
      activities.push({
        id: `activity-${i}-1`,
        goalId: 'goal-4',
        title: 'Reading Session',
        startTime: '09:00',
        endTime: '11:00',
        date: dateStr,
        status: 'pending'
      });
    }
  }

  return activities;
};