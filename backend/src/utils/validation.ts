import { z } from 'zod';

// User validation schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters').optional(),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters').optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters').optional(),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters').optional(),
  timezone: z.string().optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
});

// Goal validation schemas
export const createGoalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  targetDate: z.string().datetime('Invalid date format').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

export const updateGoalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters').optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  targetDate: z.string().datetime('Invalid date format').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED']).optional(),
  progress: z.number().min(0, 'Progress must be at least 0').max(100, 'Progress cannot exceed 100').optional(),
});

// Task validation schemas
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().datetime('Invalid date format').optional(),
  estimatedTime: z.number().min(1, 'Estimated time must be at least 1 minute').optional(),
  goalId: z.string().cuid('Invalid goal ID').optional(),
  tags: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters').optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  dueDate: z.string().datetime('Invalid date format').optional(),
  estimatedTime: z.number().min(1, 'Estimated time must be at least 1 minute').optional(),
  actualTime: z.number().min(1, 'Actual time must be at least 1 minute').optional(),
  goalId: z.string().cuid('Invalid goal ID').optional(),
  tags: z.array(z.string()).optional(),
});

// Schedule validation schemas
export const createScheduleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  startTime: z.string().datetime('Invalid start time format'),
  endTime: z.string().datetime('Invalid end time format'),
  allDay: z.boolean().default(false),
  recurring: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
}).refine((data) => {
  if (!data.allDay) {
    return new Date(data.startTime) < new Date(data.endTime);
  }
  return true;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
});

export const updateScheduleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters').optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  startTime: z.string().datetime('Invalid start time format').optional(),
  endTime: z.string().datetime('Invalid end time format').optional(),
  allDay: z.boolean().optional(),
  recurring: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
});

// Habit validation schemas
export const createHabitSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  targetCount: z.number().min(1, 'Target count must be at least 1').default(1),
});

export const updateHabitSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters').optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  targetCount: z.number().min(1, 'Target count must be at least 1').optional(),
});

// Habit completion validation schemas
export const createHabitCompletionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  count: z.number().min(1, 'Count must be at least 1').default(1),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

// Query validation schemas
export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1, 'Page must be at least 1')).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100')).default('10'),
});

export const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
});

// Export types
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
