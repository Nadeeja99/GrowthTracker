// Single source of truth for TanStack Query cache keys.
export const queryKeys = {
  goals: ['goals'] as const,
  tasks: ['tasks'] as const,
  schedules: ['schedules'] as const,
  habits: ['habits'] as const,
  reflections: ['reflections'] as const,
  focusSessions: ['focus-sessions'] as const,
  coach: ['coach'] as const,
  analyticsOverview: (startDate: string, endDate: string) => ['analytics', 'overview', startDate, endDate] as const,
};
