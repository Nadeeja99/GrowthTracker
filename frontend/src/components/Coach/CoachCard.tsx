'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { useCoachPanel } from '@/contexts/CoachContext';
import { useCoach } from '@/hooks/data/useCoach';
import { STARTER_PROMPTS } from './CoachPanel';

/** Entry point to the coach on the Today page (hidden when the server has no AI provider). */
export function CoachCard() {
  const status = useCoach().data;
  const { open, send, pending } = useCoachPanel();
  if (!status?.configured) return null;

  const ask = (prompt: string) => {
    if (status.enabled && !pending) {
      open();
      send(prompt);
    } else {
      open(prompt); // opt in first; the question waits in the input
    }
  };

  return (
    <section aria-labelledby="coach-card-title" className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 md:p-5">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 mt-0.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <div>
          <h2 id="coach-card-title" className="font-semibold text-gray-900 dark:text-white">Ask your coach</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Advice based on your goals, plan and reviews.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {STARTER_PROMPTS.slice(0, 3).map(prompt => (
          <button
            key={prompt}
            type="button"
            onClick={() => ask(prompt)}
            className="px-3 py-1.5 text-sm rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {prompt}
          </button>
        ))}
      </div>
    </section>
  );
}
