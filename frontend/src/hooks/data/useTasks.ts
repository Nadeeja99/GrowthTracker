'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SubTask, Task } from '@/types';
import { apiClient, BackendTask } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { mapBackendTaskToFrontend, mapFrontendTaskToBackend, mapFrontendTaskUpdateToBackend } from '@/lib/taskMapper';

export function useTasks() {
  return useQuery({
    queryKey: queryKeys.tasks,
    queryFn: async () => (await apiClient.getTasks()).data!.tasks.map(mapBackendTaskToFrontend),
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
    mutationFn: (task: Omit<Task, 'id' | 'createdAt'>) => apiClient.createTask(mapFrontendTaskToBackend(task)),
    onSuccess: res => putTask(res.data!.task, { prepend: true }),
  });

  const update = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      apiClient.updateTask(id, mapFrontendTaskUpdateToBackend(updates)),
    onSuccess: res => putTask(res.data!.task),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.deleteTask(id),
    onSuccess: (_res, id) => {
      queryClient.setQueryData<Task[]>(queryKeys.tasks, old => old?.filter(t => t.id !== id));
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules }); // blocks lose their task link
    },
  });

  // Optimistic: the checkbox flips immediately and rolls back if the save fails.
  const updateSubtask = useMutation({
    mutationFn: ({ taskId, subtaskId, updates }: { taskId: string; subtaskId: string; updates: Partial<SubTask> }) =>
      apiClient.updateSubtask(taskId, subtaskId, { title: updates.title, completed: updates.completed }),
    onMutate: async ({ taskId, subtaskId, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks });
      const previous = queryClient.getQueryData<Task[]>(queryKeys.tasks);
      queryClient.setQueryData<Task[]>(queryKeys.tasks, old => old?.map(task =>
        task.id === taskId
          ? { ...task, subtasks: task.subtasks.map(st => (st.id === subtaskId ? { ...st, ...updates } : st)) }
          : task
      ));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.tasks, context.previous);
    },
  });

  return { create, update, remove, updateSubtask };
}
