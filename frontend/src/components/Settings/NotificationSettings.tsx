'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, PushSettings } from '@/lib/api';
import { currentPushSubscription, disablePush, enablePush, pushSupport, PushSupport } from '@/lib/push';
import { queryKeys } from '@/lib/queryKeys';
import { describeError } from '@/lib/toast';

const DEFAULT_TIMES = { morning: '07:00', evening: '20:00' };

// Half-hour steps, the interval digests go out on.
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

const NOT_READY: Record<Exclude<PushSupport, 'ready'>, string> = {
  'needs-install': 'On iPhone and iPad, notifications work once GrowthTracker is on your Home Screen. In Safari, tap Share, then Add to Home Screen, and open it from there.',
  blocked: 'Notifications are blocked for GrowthTracker. Allow them in your phone or browser settings, then come back here.',
  unsupported: 'This browser doesn’t support notifications.',
};

const buttonClass = 'px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60';

function DigestRow({ label, hint, value, fallback, onChange }: {
  label: string;
  hint: string;
  value: string | null;
  fallback: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-t border-gray-200 dark:border-gray-700">
      <label className="flex items-start gap-3 min-w-0">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={e => onChange(e.target.checked ? fallback : null)}
          className="mt-0.5 h-5 w-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
        />
        <span>
          <span className="block text-sm font-medium text-gray-900 dark:text-white">{label}</span>
          <span className="block text-sm text-gray-500 dark:text-gray-400">{hint}</span>
        </span>
      </label>
      {value !== null && (
        <select
          aria-label={`${label} time`}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
        >
          {TIMES.map(time => <option key={time} value={time}>{time}</option>)}
        </select>
      )}
    </div>
  );
}

export function NotificationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: queryKeys.pushSettings,
    queryFn: async () => (await apiClient.getPushSettings()).data!,
  });
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const show = (found: boolean) => {
      if (cancelled) return;
      setSupport(pushSupport());
      setSubscribed(found);
    };
    currentPushSubscription().then(subscription => show(!!subscription), () => show(false));
    return () => { cancelled = true; };
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
      setSupport(pushSupport());
    }
  };

  // Shown at once, so a second quick change builds on the first.
  const saveTimes = async (times: Pick<PushSettings, 'morning' | 'evening'>) => {
    queryClient.setQueryData<PushSettings>(queryKeys.pushSettings, old => old && { ...old, ...times });
    try {
      await apiClient.savePushTimes(times);
    } catch (err) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pushSettings });
      throw err;
    }
  };

  const turnOn = () => run(async () => {
    await enablePush(settings.data!.publicKey!);
    setSubscribed(true);
    if (!settings.data!.morning && !settings.data!.evening) await saveTimes(DEFAULT_TIMES);
    setNotice('Notifications are on for this device.');
  });

  const turnOff = () => run(async () => {
    await disablePush();
    setSubscribed(false);
    setNotice('Notifications are off for this device.');
  });

  const sendTest = () => run(async () => {
    await apiClient.sendTestPush();
    setNotice('Sent. It should arrive in a moment.');
  });

  const { morning = null, evening = null, available = false } = settings.data ?? {};

  let body: React.ReactNode;
  if (user?.isDemo) {
    body = <p className="text-sm text-gray-500 dark:text-gray-400">Notifications aren’t available on the shared demo account.</p>;
  } else if (settings.isPending || support === null) {
    body = <p className="text-sm text-gray-500 dark:text-gray-400">{settings.fetchStatus === 'paused' ? 'Connect to the internet to change notifications.' : 'Loading…'}</p>;
  } else if (settings.isError) {
    body = <p role="alert" className="text-sm text-red-700 dark:text-red-300">{describeError(settings.error)}</p>;
  } else if (!available) {
    body = <p className="text-sm text-gray-500 dark:text-gray-400">Notifications aren’t set up on this server yet.</p>;
  } else if (support !== 'ready') {
    body = <p className="text-sm text-gray-500 dark:text-gray-400">{NOT_READY[support]}</p>;
  } else if (!subscribed) {
    body = (
      <>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Get a short summary of your plan in the morning and a nudge to check in during the evening, even when the app is closed.
        </p>
        <button onClick={turnOn} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60">
          {busy ? 'Turning on…' : 'Turn on notifications'}
        </button>
      </>
    );
  } else {
    body = (
      <>
        <DigestRow
          label="Morning digest"
          hint="Your blocks, due tasks and habits for the day"
          value={morning}
          fallback={DEFAULT_TIMES.morning}
          onChange={value => run(() => saveTimes({ morning: value, evening }))}
        />
        <DigestRow
          label="Evening check-in"
          hint="Habits still to do, and a reminder to review your day"
          value={evening}
          fallback={DEFAULT_TIMES.evening}
          onChange={value => run(() => saveTimes({ morning, evening: value }))}
        />
        <p className="pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          Times use your account’s time zone ({user?.timezone.replace(/_/g, ' ')}) and can arrive a little late. Days with nothing to report stay quiet. Notifications can show task and habit names on your lock screen.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={sendTest} disabled={busy} className={buttonClass}>Send a test</button>
          <button onClick={turnOff} disabled={busy} className={buttonClass}>Turn off on this device</button>
        </div>
      </>
    );
  }

  return (
    <section aria-labelledby="notifications-title" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <Bell className="w-5 h-5" />
        </div>
        <h2 id="notifications-title" className="text-lg font-bold text-gray-900 dark:text-white">Notifications</h2>
      </div>
      {body}
      {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-gray-700 dark:text-gray-200">{notice}</p>}
    </section>
  );
}
