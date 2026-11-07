'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Task } from '@/types';
import { apiClient, BackendTask } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { withPendingTasks } from '@/lib/checkIns';
import { mapBackendTaskToFrontend, mapFrontendTaskToBackend, mapFrontendTaskUpdateToBackend } from '@/lib/taskMapper';

export function useTasks() {
  return useQuery({
    queryKey: queryKeys.tasks,
    queryFn: async () => withPendingTasks((await apiClient.getTasks()).data!.tasks.map(mapBackendTaskToFrontend)),
  });
}

export function useTaskMutations() {
  const queryClient = useQueryClient();

  const putTask = (backendTask: BackendTask, { prepend = false } = {}) => {
    const task = mapBackendTaskToFrontend(backendTask);
    queryClient.setQueryData<Task[]>(queryKeys.tasks, old => {
      if (old?.some(t => t.id === task.id)) return old.map(t => (t.id === task.id ? task : t));
      return prepend ? [task, ...(old ?? [])] : [...(old ?? []), task];
    });
  };

  const create = useMutation({
    meta: { action: 'create the task' },
    mutationFn: (task: Omit<Task, 'id' | 'createdAt'>) => apiClient.createTask(mapFrontendTaskToBackend(task)),
    onSuccess: res => putTask(res.data!.task, { prepend: true }),
  });

  const update = useMutation({
    meta: { action: 'save the task' },
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      apiClient.updateTask(id, mapFrontendTaskUpdateToBackend(updates)),
    onSuccess: res => putTask(res.data!.task),
  });

  const remove = useMutation({
    meta: { action: 'delete the task' },
    mutationFn: (id: string) => apiClient.deleteTask(id),
    onSuccess: (_res, id) => {
      queryClient.setQueryData<Task[]>(queryKeys.tasks, old => old?.filter(t => t.id !== id));
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules }); // blocks lose their task link
    },
  });

  return { create, update, remove };
}
