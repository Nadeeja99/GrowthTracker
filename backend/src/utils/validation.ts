import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3).max(30),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  timezone: z.string().optional(),
  avatar: z.string().url().optional(),
});

export const createGoalSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  targetDate: z.string().datetime().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

export const updateGoalSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  targetDate: z.string().datetime().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED']).optional(),
  progress: z.number().min(0).max(100).optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().datetime().optional(),
  estimatedTime: z.number().min(1).optional(),
  goalId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  dueDate: z.string().datetime().optional(),
  estimatedTime: z.number().min(1).optional(),
  actualTime: z.number().min(1).optional(),
  goalId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
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
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().min(1).default(1),
  notes: z.string().max(500).optional(),
});

export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(500)).default('50'),
});

export const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
