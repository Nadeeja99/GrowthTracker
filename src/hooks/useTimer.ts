'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TimerState {
  timeRemaining: number;
  isRunning: boolean;
  currentSession: 'work' | 'break' | 'longBreak';
  cycleCount: number;
}

export function useTimer() {
  const [state, setState] = useState<TimerState>({
    timeRemaining: 25 * 60, // 25 minutes in seconds
    isRunning: false,
    currentSession: 'work',
    cycleCount: 0
  });

  const settings = {
    workDuration: 25 * 60,
    breakDuration: 5 * 60,
    longBreakDuration: 15 * 60,
    cyclesBeforeLongBreak: 4
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (state.isRunning && state.timeRemaining > 0) {
      interval = setInterval(() => {
        setState(prev => ({
          ...prev,
          timeRemaining: prev.timeRemaining - 1
        }));
      }, 1000);
    } else if (state.isRunning && state.timeRemaining === 0) {
      // Timer finished, handle session transition
      handleSessionComplete();
    }

    return () => clearInterval(interval);
  }, [state.isRunning, state.timeRemaining]);

  const handleSessionComplete = useCallback(() => {
    setState(prev => {
      let nextSession: 'work' | 'break' | 'longBreak';
      let newCycleCount = prev.cycleCount;
      let nextDuration: number;

      if (prev.currentSession === 'work') {
        newCycleCount += 1;
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
        cycleCount: newCycleCount
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
    setState({
      timeRemaining: settings.workDuration,
      isRunning: false,
      currentSession: 'work',
      cycleCount: 0
    });
  }, []);

  const skipSession = useCallback(() => {
    handleSessionComplete();
  }, [handleSessionComplete]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    ...state,
    startTimer,
    pauseTimer,
    resetTimer,
    skipSession,
    formatTime: (seconds?: number) => formatTime(seconds ?? state.timeRemaining),
    progress: 1 - (state.timeRemaining / (
      state.currentSession === 'work' ? settings.workDuration :
      state.currentSession === 'break' ? settings.breakDuration :
      settings.longBreakDuration
    ))
  };
}