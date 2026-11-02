'use client';

import React, { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { describeError } from '@/lib/toast';
import { useSlowFlag, WAKING_UP_MESSAGE } from '@/hooks/useSlowFlag';
import { inputClass } from '@/components/ui/PasswordField';

/** "Forgot password": asks for the email and explains what happens next. */
export function ForgotPasswordForm({ initialEmail = '', onBack }: { initialEmail?: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const slow = useSlowFlag(sending);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await apiClient.forgotPassword(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl px-6 sm:px-8 pt-6 pb-8 mb-4">
        {sentTo ? (
          <div role="status" className="text-center">
            <MailCheck className="w-10 h-10 mx-auto text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h2 className="mt-3 text-xl font-semibold text-gray-900 dark:text-white">Check your email</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              If an account uses <strong className="text-gray-900 dark:text-white break-all">{sentTo}</strong>, a link to choose a new password is on its way. It works once and expires in 30 minutes.
            </p>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Nothing after a few minutes? Check your spam folder, or try again.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={onBack} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md">
                Back to sign in
              </button>
              <button type="button" onClick={() => setSentTo(null)} className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-center text-gray-900 dark:text-white">Forgot your password?</h2>
            <p className="mt-2 mb-6 text-sm text-center text-gray-600 dark:text-gray-400">
              Enter the email you signed up with and we&apos;ll send you a link to choose a new one.
            </p>
            {error && (
              <div role="alert" className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}
            {slow && <p role="status" className="text-sm text-gray-600 dark:text-gray-400 mb-4">{WAKING_UP_MESSAGE}</p>}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button type="submit" disabled={sending} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-md">
                {sending ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <div className="text-center mt-4">
              <button type="button" onClick={onBack} className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                Back to sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
