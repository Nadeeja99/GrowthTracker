'use client';

import React from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useCheckInSync, useIsOnline, usePendingCheckIns } from '@/hooks/data/useCheckIns';

const waiting = (count: number) => `${count} check-in${count === 1 ? '' : 's'} waiting to sync.`;

/** Says what the app can do without a connection, and keeps check-ins moving. */
export function OfflineBanner() {
  useCheckInSync();
  const isOnline = useIsOnline();
  const pending = usePendingCheckIns().length;

  return (
    // Always in the page, so screen readers announce it when the text changes.
    <div role="status">
      {!isOnline && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
          <p className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
            <CloudOff className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>
              You&apos;re offline. This is your last saved plan, and check-ins are kept on this device.
              {pending > 0 && <strong className="font-medium"> {waiting(pending)}</strong>}
            </span>
          </p>
        </div>
      )}
      {isOnline && pending > 0 && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
          <p className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <RefreshCw className="w-4 h-4 flex-shrink-0 motion-safe:animate-spin" aria-hidden="true" />
            <span>Syncing. {waiting(pending)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
