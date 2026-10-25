'use client';

import React, { useState } from 'react';
import { Globe2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { describeError } from '@/lib/toast';

const DISMISSED_KEY = 'timezone-notice-dismissed';

/**
 * "Today", streaks and AI plans follow the account's time zone. When this
 * device is somewhere else (travel, or a stale setting), offer to switch.
 */
export function TimezoneNotice() {
  const { user, updateUser } = useAuth();
  const [deviceZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY);
    } catch {
      return null;
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || !deviceZone || user.timezone === deviceZone) return null;
  const pair = `${user.timezone}>${deviceZone}`;
  if (dismissed === pair) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, pair);
    } catch {
      // Private mode: the notice just comes back next visit.
    }
    setDismissed(pair);
  };

  const switchZone = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.updateProfile({ timezone: deviceZone });
      if (res.data?.user) updateUser({ ...user, ...res.data.user });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="region" aria-label="Time zone" className="border-b border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-amber-900 dark:text-amber-200">
        <Globe2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <p className="flex-1 min-w-[16rem]">
          This device is on <strong>{deviceZone.replace(/_/g, ' ')}</strong> time, but your account uses <strong>{user.timezone.replace(/_/g, ' ')}</strong>. Days, streaks and plans follow the account.
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={switchZone} disabled={saving} className="px-3 py-1.5 rounded-lg bg-amber-900 text-white dark:bg-amber-200 dark:text-amber-950 font-medium disabled:opacity-60">
            {saving ? 'Switching…' : `Use ${deviceZone.split('/').pop()?.replace(/_/g, ' ')} time`}
          </button>
          <button type="button" onClick={dismiss} aria-label="Keep the account's time zone" className="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40">
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && <p role="alert" className="w-full text-red-700 dark:text-red-300">{error}</p>}
      </div>
    </div>
  );
}
