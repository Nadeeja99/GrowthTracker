'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { submitOnModEnter } from '@/lib/forms';
import { useSlowFlag, WAKING_UP_MESSAGE } from '@/hooks/useSlowFlag';

// Set at build time where the API has DEMO_LOGIN_ENABLED=true.
const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_LOGIN === 'true';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const slow = useSlowFlag(isLoading || demoLoading);

  const { login, loginDemo } = useAuth();

  const handleDemo = async () => {
    setError('');
    setDemoLoading(true);
    try {
      await loginDemo();
      router.push('/today');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Couldn’t open the demo. Please try again.');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      // Login successful - redirect to main page
      router.push('/today');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl px-6 sm:px-8 pt-6 pb-8 mb-4">
        <h2 className="text-xl font-semibold text-center text-gray-900 dark:text-white mb-6">
          Welcome back
        </h2>
        
        {error && (
          <div role="alert" className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        {slow && <p role="status" className="text-sm text-gray-600 dark:text-gray-400 mb-4">{WAKING_UP_MESSAGE}</p>}

        <form onKeyDown={submitOnModEnter} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input autoFocus
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || demoLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-md transition duration-200 ease-in-out"
          >
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {DEMO_ENABLED && (
          <>
            <div className="flex items-center gap-3 my-5" aria-hidden="true">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-500 dark:text-gray-400">or</span>
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>
            <button
              type="button"
              onClick={handleDemo}
              disabled={isLoading || demoLoading}
              className="w-full py-2 px-4 rounded-md border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
            >
              {demoLoading ? 'Opening the demo…' : 'Try the demo'}
            </button>
            <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
              A shared account with a week of sample data. No sign-up needed.
            </p>
          </>
        )}

        <div className="text-center mt-4">
          <button
            onClick={onSwitchToRegister}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
          >
            Don&apos;t have an account? Sign up
          </button>
        </div>
      </div>
    </div>
  );
};
