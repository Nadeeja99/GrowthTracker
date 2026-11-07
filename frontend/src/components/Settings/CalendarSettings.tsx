'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Copy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { describeError } from '@/lib/toast';

// Straight to the API, not through this app: calendar apps can't wake a sleeping
// API through the proxy, and a direct request does (see lib/api.ts).
const API_URL = process.env.NEXT_PUBLIC_API_WAKE_URL ?? 'http://localhost:5000/';

export const feedUrl = (token: string) => `${API_URL.replace(/\/$/, '')}/calendar/${token}.ics`;

const buttonClass = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60';

export function CalendarSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const feed = useQuery({
    queryKey: queryKeys.calendarFeed,
    queryFn: async () => (await apiClient.getCalendarFeed()).data!,
    enabled: !user?.isDemo,
  });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const token = await action();
      queryClient.setQueryData(queryKeys.calendarFeed, { token });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const turnOn = () => run(async () => (await apiClient.createCalendarFeed()).data!.token);

  const turnOff = async () => {
    const ok = await confirm({
      title: 'Turn off the calendar link?',
      message: 'Calendars subscribed to it will stop updating.',
      confirmLabel: 'Turn off',
    });
    if (ok) await run(async () => { await apiClient.deleteCalendarFeed(); return null; });
  };

  const replace = async () => {
    const ok = await confirm({
      title: 'Replace the calendar link?',
      message: 'The current link stops working, and you’ll need to add the new one to your calendars.',
      confirmLabel: 'Replace',
    });
    if (ok) await turnOn();
  };

  const token = feed.data?.token ?? null;
  const url = token ? feedUrl(token) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError('Couldn’t copy. Select the link and copy it instead.');
    }
  };

  let body: React.ReactNode;
  if (user?.isDemo) {
    body = <p className="text-sm text-gray-500 dark:text-gray-400">The calendar link isn’t available on the shared demo account.</p>;
  } else if (feed.isPending) {
    body = <p className="text-sm text-gray-500 dark:text-gray-400">{feed.fetchStatus === 'paused' ? 'Connect to the internet to manage your calendar link.' : 'Loading…'}</p>;
  } else if (feed.isError) {
    body = <p role="alert" className="text-sm text-red-700 dark:text-red-300">{describeError(feed.error)}</p>;
  } else if (!token) {
    body = (
      <>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          See your time blocks and due dates in Google Calendar, Apple Calendar or Outlook, next to everything else in your day. It’s read-only: changes are made here.
        </p>
        <button onClick={turnOn} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60">
          {busy ? 'Turning on…' : 'Turn on calendar link'}
        </button>
      </>
    );
  } else {
    const webcal = url.replace(/^https?:/, 'webcal:');
    body = (
      <>
        <label htmlFor="calendar-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your private link</label>
        <div className="flex gap-2">
          <input
            id="calendar-url"
            readOnly
            value={url}
            onFocus={e => e.target.select()}
            className="min-w-0 flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          <button onClick={copy} className={buttonClass}>
            {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Anyone with this link can see your schedule, so treat it like a password. Calendar apps refresh on their own timing, from about an hour to a day.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={webcal} className={buttonClass}>Add to Apple Calendar</a>
          <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noreferrer" className={buttonClass}>Add to Google Calendar</a>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={replace} disabled={busy} className={buttonClass}>Replace link</button>
          <button onClick={turnOff} disabled={busy} className={buttonClass}>Turn off</button>
        </div>
      </>
    );
  }

  return (
    <section aria-labelledby="calendar-title" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <CalendarDays className="w-5 h-5" />
        </div>
        <h2 id="calendar-title" className="text-lg font-bold text-gray-900 dark:text-white">Calendar</h2>
      </div>
      {body}
      {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
    </section>
  );
}
