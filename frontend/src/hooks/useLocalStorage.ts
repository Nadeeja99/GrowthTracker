'use client';

import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export function useAutoSave<T>(key: string, data: T, interval: number = 30000) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const saveInterval = setInterval(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(data));
      } catch (error) {
        console.error(`Auto-save failed for key "${key}":`, error);
      }
    }, interval);

    return () => clearInterval(saveInterval);
  }, [key, data, interval]);
}