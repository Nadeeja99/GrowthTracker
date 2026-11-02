'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent';

/** A labelled password input with a show/hide toggle (handy when typing on a phone). */
export function PasswordField({ id, label, value, onChange, autoComplete, hint, autoFocus }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  hint?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-describedby={hint ? `${id}-hint` : undefined}
          required
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label="Show password"
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

/** Client-side checks shared by every "new password" form (the API checks again). */
export function newPasswordProblem(password: string, confirm: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (password.length > 128) return 'Use at most 128 characters.';
  if (password !== confirm) return 'The two passwords don’t match.';
  return null;
}
