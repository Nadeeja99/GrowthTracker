import { ScheduleActivity } from '@/types';
import { toDateKey } from '@/lib/dates';

interface BackendSchedule {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'RESCHEDULED';
  notes?: string;
  actualTimeSpent?: number;
  goalId?: string;
  taskId?: string;
  createdAt: string;
  updatedAt: string;
  goal?: { id: string; title: string };
  task?: { id: string; title: string; status: string };
}

const STATUS_MAP: Record<string, ScheduleActivity['status']> = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  RESCHEDULED: 'rescheduled',
};

const STATUS_TO_BACKEND: Record<ScheduleActivity['status'], string> = {
  pending: 'PENDING',
  'in-progress': 'IN_PROGRESS',
  completed: 'COMPLETED',
  skipped: 'SKIPPED',
  rescheduled: 'RESCHEDULED',
};

export function mapBackendScheduleToFrontend(schedule: BackendSchedule): ScheduleActivity {
  const startDate = new Date(schedule.startTime);
  const endDate = new Date(schedule.endTime);

  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return {
    id: schedule.id,
    goalId: schedule.goalId,
    taskId: schedule.taskId,
    taskTitle: schedule.task?.title,
    title: schedule.title,
    startTime: timeStr(startDate),
    endTime: timeStr(endDate),
    date: toDateKey(startDate),
    status: STATUS_MAP[schedule.status] ?? 'pending',
    notes: schedule.notes,
    actualTimeSpent: schedule.actualTimeSpent,
  };
}

export function mapFrontendActivityToBackend(activity: Omit<ScheduleActivity, 'id' | 'taskTitle'>): {
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
  actualTimeSpent?: number;
  goalId?: string;
  taskId?: string;
} {
  const combineDateTime = (date: string, time: string) =>
    new Date(`${date}T${time}:00`).toISOString();

  return {
    title: activity.title,
    startTime: combineDateTime(activity.date, activity.startTime),
    endTime: combineDateTime(activity.date, activity.endTime),
    status: STATUS_TO_BACKEND[activity.status] ?? 'PENDING',
    notes: activity.notes,
    actualTimeSpent: activity.actualTimeSpent,
    goalId: activity.goalId || undefined,
    taskId: activity.taskId || undefined,
  };
}

export function mapFrontendActivityUpdateToBackend(updates: Partial<ScheduleActivity>, currentDate?: string): {
  title?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  notes?: string;
  actualTimeSpent?: number;
  goalId?: string | null;
  taskId?: string | null;
} {
  const result: any = {};

  if (updates.title !== undefined) result.title = updates.title;
  if (updates.notes !== undefined) result.notes = updates.notes;
  if (updates.actualTimeSpent !== undefined) result.actualTimeSpent = updates.actualTimeSpent;
  if (updates.goalId !== undefined) result.goalId = updates.goalId || null;
  if (updates.taskId !== undefined) result.taskId = updates.taskId || null;
  if (updates.status !== undefined) result.status = STATUS_TO_BACKEND[updates.status];

  const date = updates.date ?? currentDate;
  if (date && updates.startTime !== undefined) {
    result.startTime = new Date(`${date}T${updates.startTime}:00`).toISOString();
  }
  if (date && updates.endTime !== undefined) {
    result.endTime = new Date(`${date}T${updates.endTime}:00`).toISOString();
  }

  return result;
}
