import { z } from 'zod';

const isValidTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const timeZoneSchema = z.string().max(64).refine(isValidTimeZone, 'Invalid IANA time zone');
const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3).max(30),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  timezone: timeZoneSchema.optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  timezone: timeZoneSchema.optional(),
  avatar: z.string().url().optional(),
});

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Expected a hex colour like #3B82F6');
const weeklyHoursSchema = z.number().min(0).max(168);
const dailyHoursSchema = z.number().min(0).max(24);

export const createGoalSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  targetDate: z.string().datetime().optional(),
  priority: prioritySchema.default('MEDIUM'),
  color: hexColorSchema.optional(),
  targetHoursWeekly: weeklyHoursSchema.optional(),
  targetHoursDaily: dailyHoursSchema.optional(),
});

export const updateGoalSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  targetDate: z.string().datetime().nullable().optional(),
  priority: prioritySchema.optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  color: hexColorSchema.optional(),
  targetHoursWeekly: weeklyHoursSchema.optional(),
  targetHoursDaily: dailyHoursSchema.optional(),
});

export const createMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(200),
  targetDate: z.string().datetime().optional(),
});

export const updateMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  completed: z.boolean().optional(),
  targetDate: z.string().datetime().nullable().optional(),
});

// Tags are a set of short labels: trimmed, de-duplicated (case-insensitive).
const tagsSchema = z.array(z.string().trim().min(1).max(30)).max(20).transform(tags => {
  const seen = new Set<string>();
  return tags.filter(tag => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

// The full, ordered subtask list. Items without an id are created; existing
// items not in the list are deleted.
const subtaskListSchema = z.array(z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  completed: z.boolean().default(false),
})).max(50);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  priority: prioritySchema.default('MEDIUM'),
  dueDate: z.string().datetime().optional(),
  estimatedTime: z.number().min(1).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PENDING'),
  goalId: z.string().optional(),
  tags: tagsSchema.optional(),
  subtasks: subtaskListSchema.optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  priority: prioritySchema.optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedTime: z.number().min(1).optional(),
  actualTime: z.number().min(1).optional(),
  goalId: z.string().optional().nullable(),
  tags: tagsSchema.optional(),
  subtasks: subtaskListSchema.optional(),
});

export const updateSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  completed: z.boolean().optional(),
});

export const createScheduleSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  allDay: z.boolean().default(false),
  recurring: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'RESCHEDULED']).default('PENDING'),
  notes: z.string().max(500).optional(),
  actualTimeSpent: z.number().min(0).optional(),
  goalId: z.string().optional(),
  taskId: z.string().optional(),
}).refine((data) => {
  if (!data.allDay) {
    return new Date(data.startTime) < new Date(data.endTime);
  }
  return true;
}, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

// Recurring schedules create many blocks at once.
export const bulkCreateSchedulesSchema = z.object({
  schedules: z.array(createScheduleSchema).min(1).max(200),
});

export const updateScheduleSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  recurring: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'RESCHEDULED']).optional(),
  notes: z.string().max(500).optional(),
  actualTimeSpent: z.number().min(0).optional(),
  goalId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
});

export const createHabitSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  targetCount: z.number().min(1).default(1),
});

export const updateHabitSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  targetCount: z.number().min(1).optional(),
});

export const createHabitCompletionSchema = z.object({
  date: dateKeySchema,
  count: z.number().min(1).default(1),
  notes: z.string().max(500).optional(),
});

export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(500)).default('50'),
});

// Calendar days (YYYY-MM-DD) interpreted in the user's time zone, inclusive.
export const dateRangeSchema = z.object({
  startDate: dateKeySchema.optional(),
  endDate: dateKeySchema.optional(),
}).refine(r => !r.startDate || !r.endDate || r.startDate <= r.endDate, {
  message: 'startDate must be on or before endDate',
  path: ['startDate'],
});

// ISO timestamps (instants), e.g. for calendar or focus-session queries.
export const instantRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).refine(r => !r.startDate || !r.endDate || new Date(r.startDate) <= new Date(r.endDate), {
  message: 'startDate must be on or before endDate',
  path: ['startDate'],
});

const ratingSchema = z.number().int().min(1).max(5).nullable().optional();

export const reflectionSchema = z.object({
  performance: ratingSchema,
  energy: ratingSchema,
  mood: ratingSchema,
  notes: z.string().max(5000).nullable().optional(),
});

export const reflectionDateParamSchema = z.object({ date: dateKeySchema });

// One-time upload of reviews that older app versions kept in localStorage.
export const importReflectionsSchema = z.object({
  reflections: z.array(reflectionSchema.extend({ date: dateKeySchema })).max(400),
});

export const createFocusSessionSchema = z.object({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number().int().min(1).max(12 * 60 * 60),
  plannedSeconds: z.number().int().min(1).max(12 * 60 * 60),
  completed: z.boolean(),
  goalId: z.string().optional(),
  taskId: z.string().optional(),
  scheduleId: z.string().optional(),
}).refine(s => new Date(s.startedAt) < new Date(s.endedAt), {
  message: 'endedAt must be after startedAt',
  path: ['endedAt'],
});

export const coachMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(1000, 'Keep messages under 1000 characters'),
});

export const coachSettingsSchema = z.object({ enabled: z.boolean() });

export const weekStartSchema = z.object({ weekStart: dateKeySchema });

const clockTimeSchema = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'Expected HH:MM');

export const weekPlanRequestSchema = z.object({
  weekStart: dateKeySchema,
  // The part of each day the plan may use, in the user's local time.
  window: z.object({ start: clockTimeSchema, end: clockTimeSchema }).default({ start: '07:00', end: '21:00' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type CreateHabitCompletionInput = z.infer<typeof createHabitCompletionSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
