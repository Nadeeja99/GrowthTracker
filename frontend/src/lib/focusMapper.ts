import { FocusSession } from '@/types';
import { BackendFocusSession } from '@/lib/api';

export function mapBackendFocusSession(session: BackendFocusSession): FocusSession {
  return {
    id: session.id,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSeconds: session.durationSeconds,
    plannedSeconds: session.plannedSeconds,
    completed: session.completed,
    goalId: session.goalId ?? undefined,
    taskId: session.taskId ?? undefined,
    scheduleId: session.scheduleId ?? undefined,
  };
}
