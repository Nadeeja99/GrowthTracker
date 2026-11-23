'use client';

import { useEffect, useState } from 'react';

/**
 * True once `pending` has lasted longer than `delayMs`, so a slow request can
 * say it's still going instead of looking stuck.
 */
export function useSlowFlag(pending: boolean, delayMs = 4000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [pending, delayMs]);
  return pending && slow;
}

export const SLOW_MESSAGE = 'Still working on it. This is taking longer than usual.';
