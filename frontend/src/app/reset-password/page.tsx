'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';
import { describeError, toast } from '@/lib/toast';
import { useSlowFlag, WAKING_UP_MESSAGE } from '@/hooks/useSlowFlag';
import { newPasswordProblem, PasswordField } from '@/components/ui/PasswordField';

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { resetPassword } = useAuth();
  // Read once: the token is then removed from the address bar (and history).
  const [token] = useState(() => params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [linkInvalid, setLinkInvalid] = useState(!token);
  const slow = useSlowFlag(saving);

  useEffect(() => {
    if (token) window.history.replaceState(null, '', '/reset-password');
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = newPasswordProblem(password, confirm);
    if (problem) return setError(problem);
    setError('');
    setSaving(true);
    try {
      await resetPassword(token, password);
      toast.success('Password updated. You’re signed in, and other devices were signed out.');
      router.replace('/today');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && /link/.test(err.message)) setLinkInvalid(true);
      else setError(describeError(err));
      setSaving(false);
    }
  };

  if (linkInvalid) {
    return (
      <div role="alert" className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">This link doesn&apos;t work any more</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Reset links work once and expire after 30 minutes. Ask for a new one and use the latest email.
        </p>
        <Link href="/auth?mode=forgot" className="mt-5 inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md">
          Send a new link
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-center text-gray-900 dark:text-white flex items-center justify-center gap-2">
        <KeyRound className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" /> Choose a new password
      </h2>
      <p className="mt-2 mb-6 text-sm text-center text-gray-600 dark:text-gray-400">
        You&apos;ll be signed in here, and signed out on every other device.
      </p>
      {error && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}
      {slow && <p role="status" className="text-sm text-gray-600 dark:text-gray-400 mb-4">{WAKING_UP_MESSAGE}</p>}
      <form onSubmit={submit} className="space-y-4">
        <PasswordField id="reset-new" label="New password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." autoFocus />
        <PasswordField id="reset-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-md">
          {saving ? 'Saving…' : 'Save and sign in'}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <Target className="w-7 h-7 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">GrowthTracker</h1>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl px-6 sm:px-8 pt-6 pb-8">
          <Suspense>
            <ResetPasswordForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/auth" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
