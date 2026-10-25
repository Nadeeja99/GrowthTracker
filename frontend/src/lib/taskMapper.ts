import { Task } from '@/types';
import { BackendPriority, BackendTask, SubtaskWritePayload } from '@/lib/api';

const STATUS_MAP: Record<string, Task['status']> = {
  PENDING: 'todo',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  CANCELLED: 'todo',
};

const PRIORITY_MAP: Record<string, Task['priority']> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

const STATUS_TO_BACKEND: Record<Task['status'], 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'> = {
  todo: 'PENDING',
  'in-progress': 'IN_PROGRESS',
  completed: 'COMPLETED',
};

const PRIORITY_TO_BACKEND: Record<Task['priority'], BackendPriority> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
};

export function mapBackendTaskToFrontend(backendTask: BackendTask): Task {
  return {
    id: backendTask.id,
    goalId: backendTask.goalId,
    title: backendTask.title,
    description: backendTask.description,
    priority: PRIORITY_MAP[backendTask.priority] ?? 'medium',
    status: STATUS_MAP[backendTask.status] ?? 'todo',
    // Due dates are calendar days sent as UTC midnight, so the UTC date is the intended day.
    dueDate: backendTask.dueDate ? backendTask.dueDate.slice(0, 10) : undefined,
    createdAt: backendTask.createdAt,
    completedAt: backendTask.completedAt,
    subtasks: (backendTask.subtasks ?? []).map(st => ({ id: st.id, title: st.title, completed: st.completed })),
    tags: backendTask.tags?.map(t => t.name) ?? [],
    estimatedTime: backendTask.estimatedTime,
  };
}

// Subtasks created in the form have no server id yet.
const toSubtaskPayload = (subtasks: Task['subtasks']): SubtaskWritePayload[] =>
  subtasks.map(st => ({ ...(st.id && { id: st.id }), title: st.title, completed: st.completed }));

export function mapFrontendTaskToBackend(task: Omit<Task, 'id' | 'createdAt'>): {
  title: string;
  description?: string;
  priority: BackendPriority;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate?: string;
  goalId?: string;
  estimatedTime?: number;
  tags: string[];
  subtasks: SubtaskWritePayload[];
} {
  return {
    title: task.title,
    description: task.description,
    priority: PRIORITY_TO_BACKEND[task.priority] ?? 'MEDIUM',
    status: STATUS_TO_BACKEND[task.status] ?? 'PENDING',
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : undefined,
    goalId: task.goalId || undefined,
    estimatedTime: task.estimatedTime,
    tags: task.tags,
    subtasks: toSubtaskPayload(task.subtasks),
  };
}

export function mapFrontendTaskUpdateToBackend(updates: Partial<Task>): {
  title?: string;
  description?: string;
  priority?: BackendPriority;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate?: string | null;
  goalId?: string | null;
  estimatedTime?: number;
  tags?: string[];
  subtasks?: SubtaskWritePayload[];
} {
  const result: ReturnType<typeof mapFrontendTaskUpdateToBackend> = {};

  if (updates.title !== undefined) result.title = updates.title;
  if (updates.description !== undefined) result.description = updates.description;
  if (updates.priority !== undefined) result.priority = PRIORITY_TO_BACKEND[updates.priority];
  if (updates.status !== undefined) result.status = STATUS_TO_BACKEND[updates.status];
  if (updates.dueDate !== undefined) result.dueDate = updates.dueDate ? new Date(updates.dueDate).toISOString() : null;
  if (updates.goalId !== undefined) result.goalId = updates.goalId || null;
  if (updates.estimatedTime !== undefined) result.estimatedTime = updates.estimatedTime;
  if (updates.tags !== undefined) result.tags = updates.tags;
  if (updates.subtasks !== undefined) result.subtasks = toSubtaskPayload(updates.subtasks);

  return result;
}
