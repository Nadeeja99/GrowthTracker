'use client';

import { useEffect, useState } from 'react';

/**
 * True once `pending` has lasted longer than `delayMs`. Used to explain waits
 * caused by the free hosting tier, where an idle server takes up to a minute
 * to wake up.
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

export const WAKING_UP_MESSAGE = 'Waking up the server. On the free hosting tier this can take up to a minute after a quiet spell.';
