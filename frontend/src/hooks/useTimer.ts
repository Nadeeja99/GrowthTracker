'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppSettings } from '@/types';

export interface TimerState {
  timeRemaining: number;
  isRunning: boolean;
  currentSession: 'work' | 'break' | 'longBreak';
  cycleCount: number;
  completedSessions: number;
}

function getPomodoroSettings() {
  if (typeof window === 'undefined') {
    return { workDuration: 25, breakDuration: 5, longBreakDuration: 15, cyclesBeforeLongBreak: 4 };
  }
  try {
    const stored = localStorage.getItem('dev-tracker-settings');
    if (stored) {
      const parsed: AppSettings = JSON.parse(stored);
      return parsed.pomodoroSettings;
    }
  } catch {}
  return { workDuration: 25, breakDuration: 5, longBreakDuration: 15, cyclesBeforeLongBreak: 4 };
}

export function useTimer() {
  const getSettings = () => {
    const s = getPomodoroSettings();
    return {
      workDuration: s.workDuration * 60,
      breakDuration: s.breakDuration * 60,
      longBreakDuration: s.longBreakDuration * 60,
      cyclesBeforeLongBreak: s.cyclesBeforeLongBreak,
    };
  };

  const [state, setState] = useState<TimerState>(() => ({
    timeRemaining: getSettings().workDuration,
    isRunning: false,
    currentSession: 'work',
    cycleCount: 0,
    completedSessions: 0,
  }));

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state.isRunning && state.timeRemaining > 0) {
      interval = setInterval(() => {
        setState(prev => ({ ...prev, timeRemaining: prev.timeRemaining - 1 }));
      }, 1000);
    } else if (state.isRunning && state.timeRemaining === 0) {
      handleSessionComplete();
    }
    return () => clearInterval(interval);
  }, [state.isRunning, state.timeRemaining]);

  const handleSessionComplete = useCallback(() => {
    const settings = getSettings();
    if (typeof window !== 'undefined') {
      try {
        new Audio('/notification.mp3').play().catch(() => {});
      } catch {}
    }
    setState(prev => {
      let nextSession: 'work' | 'break' | 'longBreak';
      let newCycleCount = prev.cycleCount;
      let nextDuration: number;
      let newCompleted = prev.completedSessions;

      if (prev.currentSession === 'work') {
        newCycleCount += 1;
        newCompleted += 1;
        if (newCycleCount % settings.cyclesBeforeLongBreak === 0) {
          nextSession = 'longBreak';
          nextDuration = settings.longBreakDuration;
        } else {
          nextSession = 'break';
          nextDuration = settings.breakDuration;
        }
      } else {
        nextSession = 'work';
        nextDuration = settings.workDuration;
      }

      return {
        timeRemaining: nextDuration,
        isRunning: false,
        currentSession: nextSession,
        cycleCount: newCycleCount,
        completedSessions: newCompleted,
      };
    });
  }, []);

  const startTimer = useCallback(() => {
    setState(prev => ({ ...prev, isRunning: true }));
  }, []);

  const pauseTimer = useCallback(() => {
    setState(prev => ({ ...prev, isRunning: false }));
  }, []);

  const resetTimer = useCallback(() => {
    const settings = getSettings();
    setState({
      timeRemaining: settings.workDuration,
      isRunning: false,
      currentSession: 'work',
      cycleCount: 0,
      completedSessions: 0,
    });
  }, []);

  const skipSession = useCallback(() => {
    handleSessionComplete();
  }, [handleSessionComplete]);

  const switchSession = useCallback((session: 'work' | 'break' | 'longBreak') => {
    const settings = getSettings();
    const duration =
      session === 'work' ? settings.workDuration :
      session === 'break' ? settings.breakDuration :
      settings.longBreakDuration;
    setState(prev => ({ ...prev, currentSession: session, timeRemaining: duration, isRunning: false }));
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getSessionTotal = () => {
    const settings = getSettings();
    return state.currentSession === 'work' ? settings.workDuration :
      state.currentSession === 'break' ? settings.breakDuration :
      settings.longBreakDuration;
  };

  return {
    ...state,
    startTimer,
    pauseTimer,
    resetTimer,
    skipSession,
    switchSession,
    formatTime: (seconds?: number) => formatTime(seconds ?? state.timeRemaining),
    progress: 1 - (state.timeRemaining / getSessionTotal()),
  };
}
