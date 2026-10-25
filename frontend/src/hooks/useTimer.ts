'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppSettings } from '@/types';

type SessionType = 'work' | 'break' | 'longBreak';

export interface TimerState {
  timeRemaining: number;
  isRunning: boolean;
  currentSession: SessionType;
  cycleCount: number;
  completedSessions: number;
}

export interface RecordedFocus {
  startedAt: Date;
  endedAt: Date;
  /** Time actually spent running (pauses excluded). */
  durationSeconds: number;
  plannedSeconds: number;
  completed: boolean;
}

// Stopping a focus interval early still counts once it reaches this length.
const MIN_PARTIAL_FOCUS_SECONDS = 60;

function getPomodoroSettings() {
  const defaults = { workDuration: 25, breakDuration: 5, longBreakDuration: 15, cyclesBeforeLongBreak: 4 };
  if (typeof window === 'undefined') return defaults;
  try {
    const stored = localStorage.getItem('dev-tracker-settings');
    if (stored) {
      const parsed: AppSettings = JSON.parse(stored);
      return parsed.pomodoroSettings ?? defaults;
    }
  } catch {}
  return defaults;
}

const durationFor = (session: SessionType) => {
  const s = getPomodoroSettings();
  const minutes = session === 'work' ? s.workDuration : session === 'break' ? s.breakDuration : s.longBreakDuration;
  return minutes * 60 * 1000;
};

/**
 * Pomodoro timer driven by wall-clock timestamps rather than counting ticks,
 * so it stays accurate when the browser throttles timers in background tabs.
 */
export function useTimer({ onFocusRecorded }: { onFocusRecorded?: (focus: RecordedFocus) => void } = {}) {
  const [currentSession, setCurrentSession] = useState<SessionType>('work');
  const [cycleCount, setCycleCount] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null); // set while running
  const [remainingMs, setRemainingMs] = useState(() => durationFor('work')); // used while paused
  const [now, setNow] = useState(() => Date.now());

  // Bookkeeping for the focus interval in progress (not needed for rendering).
  const focus = useRef<{ startedAt: number | null; segmentStart: number | null; accumulatedMs: number }>({
    startedAt: null, segmentStart: null, accumulatedMs: 0,
  });
  const onFocusRecordedRef = useRef(onFocusRecorded);
  onFocusRecordedRef.current = onFocusRecorded;

  const isRunning = endsAt !== null;
  const plannedMs = durationFor(currentSession);
  const msLeft = endsAt !== null ? Math.max(0, endsAt - now) : remainingMs;

  /** Reports the current focus interval (if any) and clears its bookkeeping. */
  const flushFocus = useCallback((completed: boolean) => {
    const f = focus.current;
    const endedAt = Date.now();
    const focusedMs = f.accumulatedMs + (f.segmentStart ? endedAt - f.segmentStart : 0);
    const seconds = Math.round(focusedMs / 1000);
    if (f.startedAt && seconds > 0 && (completed || seconds >= MIN_PARTIAL_FOCUS_SECONDS)) {
      onFocusRecordedRef.current?.({
        startedAt: new Date(f.startedAt),
        endedAt: new Date(endedAt),
        durationSeconds: seconds,
        plannedSeconds: Math.round(durationFor('work') / 1000),
        completed,
      });
    }
    focus.current = { startedAt: null, segmentStart: null, accumulatedMs: 0 };
  }, []);

  const goTo = useCallback((session: SessionType) => {
    setCurrentSession(session);
    setEndsAt(null);
    setRemainingMs(durationFor(session));
  }, []);

  const completeSession = useCallback((finishedNaturally: boolean) => {
    if (currentSession !== 'work') {
      goTo('work');
      return;
    }
    flushFocus(finishedNaturally);
    const nextCycle = cycleCount + 1;
    setCycleCount(nextCycle);
    if (finishedNaturally) setCompletedSessions(c => c + 1);
    goTo(nextCycle % getPomodoroSettings().cyclesBeforeLongBreak === 0 ? 'longBreak' : 'break');
    if (finishedNaturally && typeof window !== 'undefined') {
      new Audio('/notification.mp3').play().catch(() => {});
    }
  }, [currentSession, cycleCount, flushFocus, goTo]);

  // Re-render a few times a second while running; finish when time is up.
  useEffect(() => {
    if (!isRunning) return;
    if (msLeft <= 0) {
      completeSession(true);
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [isRunning, msLeft, completeSession]);

  const startTimer = useCallback(() => {
    if (isRunning) return;
    const start = Date.now();
    if (currentSession === 'work') {
      focus.current.startedAt ??= start;
      focus.current.segmentStart = start;
    }
    setNow(start);
    setEndsAt(start + remainingMs);
  }, [isRunning, currentSession, remainingMs]);

  const pauseTimer = useCallback(() => {
    if (endsAt === null) return;
    const pausedAt = Date.now();
    const f = focus.current;
    if (f.segmentStart) {
      f.accumulatedMs += pausedAt - f.segmentStart;
      f.segmentStart = null;
    }
    setRemainingMs(Math.max(0, endsAt - pausedAt));
    setEndsAt(null);
  }, [endsAt]);

  const resetTimer = useCallback(() => {
    flushFocus(false);
    setCycleCount(0);
    setCompletedSessions(0);
    goTo('work');
  }, [flushFocus, goTo]);

  const skipSession = useCallback(() => completeSession(false), [completeSession]);

  const switchSession = useCallback((session: SessionType) => {
    if (currentSession === 'work') flushFocus(false);
    goTo(session);
  }, [currentSession, flushFocus, goTo]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const timeRemaining = Math.ceil(msLeft / 1000);

  return {
    timeRemaining,
    isRunning,
    currentSession,
    cycleCount,
    completedSessions,
    startTimer,
    pauseTimer,
    resetTimer,
    skipSession,
    switchSession,
    formatTime: (seconds?: number) => formatTime(seconds ?? timeRemaining),
    progress: plannedMs > 0 ? 1 - msLeft / plannedMs : 0,
  };
}
