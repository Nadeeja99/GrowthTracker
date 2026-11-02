'use client';

import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { describeError } from '@/lib/toast';
import { newPasswordProblem, PasswordField } from '@/components/ui/PasswordField';

/** Settings → Security: change password (other devices are signed out). */
export function ChangePasswordForm() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDone(false);
    const problem = newPasswordProblem(next, confirm);
    if (problem) return setError(problem);
    setError('');
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} aria-labelledby="change-password-title" className="space-y-4">
      <div>
        <h3 id="change-password-title" className="text-sm font-semibold text-gray-900 dark:text-white">Change password</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">You&apos;ll stay signed in here; every other device is signed out.</p>
      </div>
      <PasswordField id="current-password" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordField id="new-password" label="New password" value={next} onChange={setNext} autoComplete="new-password" hint="At least 8 characters." />
        <PasswordField id="confirm-password" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {done && (
        <p role="status" className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle className="w-4 h-4" aria-hidden="true" /> Password changed. Other devices were signed out.
        </p>
      )}
      <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60">
        {saving ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}
