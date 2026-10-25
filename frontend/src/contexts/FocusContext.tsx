'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { RecordedFocus, useTimer } from '@/hooks/useTimer';
import { useRecordFocusSession } from '@/hooks/data/useFocusSessions';

/** What a focus session is attributed to. */
export interface FocusTarget {
  goalId?: string;
  taskId?: string;
  /** The planned block the session was started from. */
  scheduleId?: string;
  label?: string;
}

interface FocusContextType {
  timer: ReturnType<typeof useTimer>;
  target: FocusTarget;
  setTarget: (target: FocusTarget) => void;
  /** Opens the timer prepared for `target` (the user presses play to begin). */
  focusOn: (target: FocusTarget) => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  saveError: string | null;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

// Lives in the app shell so the timer keeps running while you switch tabs.
export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [target, setTargetState] = useState<FocusTarget>({});
  const [isOpen, setIsOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const record = useRecordFocusSession();

  // Recording reads the target at the moment a session ends.
  const targetRef = useRef(target);
  const setTarget = useCallback((next: FocusTarget) => {
    targetRef.current = next;
    setTargetState(next);
  }, []);

  const timer = useTimer({
    onFocusRecorded: (focus: RecordedFocus) => {
      const { goalId, taskId, scheduleId } = targetRef.current;
      setSaveError(null);
      record.mutate(
        {
          startedAt: focus.startedAt.toISOString(),
          endedAt: focus.endedAt.toISOString(),
          durationSeconds: focus.durationSeconds,
          plannedSeconds: focus.plannedSeconds,
          completed: focus.completed,
          goalId,
          taskId,
          scheduleId,
        },
        { onError: () => setSaveError('This focus session could not be saved. Check your connection.') }
      );
    },
  });

  const focusOn = useCallback((next: FocusTarget) => {
    const current = targetRef.current;
    const changed = current.taskId !== next.taskId || current.goalId !== next.goalId || current.scheduleId !== next.scheduleId;
    // Switching targets mid-session: save the time so far against the old target first.
    if (changed && timer.currentSession === 'work' && (timer.isRunning || timer.progress > 0)) {
      timer.resetTimer();
    }
    setTarget(next);
    setIsOpen(true);
  }, [timer, setTarget]);

  const value: FocusContextType = {
    timer,
    target,
    setTarget,
    focusOn,
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    saveError,
  };

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocus() {
  const context = useContext(FocusContext);
  if (!context) throw new Error('useFocus must be used within a FocusProvider');
  return context;
}
