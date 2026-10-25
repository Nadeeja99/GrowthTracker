'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { useCoach, useCoachMutations } from '@/hooks/data/useCoach';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { CoachDataNotice } from './CoachPanel';

/** AI Coach section of the Settings page: opt-in, usage and clearing the conversation. */
export function CoachSettings() {
  const coach = useCoach();
  const { setEnabled, clear } = useCoachMutations();
  const confirm = useConfirm();
  const status = coach.data;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center space-x-3 mb-4">
        <Sparkles className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <h2 id="coach-settings-title" className="text-lg font-bold text-gray-900 dark:text-white">AI Coach</h2>
      </div>

      {coach.isLoading && <Skeleton className="h-10 w-full" />}
      {coach.error && !status && <p role="alert" className="text-sm text-red-600 dark:text-red-400">Couldn’t load the AI Coach settings.</p>}
      {status && !status.configured && (
        <p className="text-sm text-gray-600 dark:text-gray-400">AI Coach isn’t set up on this server.</p>
      )}
      {status?.configured && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p id="coach-toggle-label" className="text-sm font-medium text-gray-900 dark:text-white">Use AI Coach</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {status.enabled
                  ? `${status.usage.remaining} of ${status.usage.limit} AI requests left today (coach, reviews, plans).`
                  : 'Off. Nothing is sent to the AI provider.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={status.enabled}
              aria-labelledby="coach-toggle-label"
              disabled={setEnabled.isPending}
              onClick={() => setEnabled.mutate(!status.enabled)}
              className={cn(
                'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-60',
                status.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              )}
            >
              <span className={cn(
                'inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transition-transform',
                status.enabled ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </button>
          </div>
          <CoachDataNotice />
          {status.messages.length > 0 && (
            <button
              type="button"
              disabled={clear.isPending}
              onClick={async () => {
                const ok = await confirm({ title: 'Clear the conversation?', message: 'Your messages with the coach are deleted. Items you added stay in your plan.', confirmLabel: 'Clear' });
                if (ok) clear.mutate();
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
            >
              Clear conversation
            </button>
          )}
        </div>
      )}
    </div>
  );
}
