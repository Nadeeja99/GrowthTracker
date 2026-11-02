'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/Auth/LoginForm';
import { RegisterForm } from '@/components/Auth/RegisterForm';
import { ForgotPasswordForm } from '@/components/Auth/ForgotPasswordForm';

type Mode = 'login' | 'register' | 'forgot';

// `?mode=forgot` opens "forgot password" directly (linked from an expired reset link).
function AuthForms() {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => (params.get('mode') === 'forgot' ? 'forgot' : 'login'));
  const [email, setEmail] = useState('');

  if (mode === 'forgot') return <ForgotPasswordForm initialEmail={email} onBack={() => setMode('login')} />;
  if (mode === 'register') return <RegisterForm onSwitchToLogin={() => setMode('login')} />;
  return (
    <LoginForm
      onSwitchToRegister={() => setMode('register')}
      onForgotPassword={typed => { setEmail(typed); setMode('forgot'); }}
    />
  );
}

export default function AuthPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // Already signed in (e.g. session restored from the refresh cookie): skip the form.
  useEffect(() => {
    if (isAuthenticated) router.replace('/today');
  }, [isAuthenticated, router]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <Target className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">GrowthTracker</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Plan the week. Do the day. See what moves your goals.
          </p>
        </div>

        <Suspense>
          <AuthForms />
        </Suspense>
      </div>
    </main>
  );
}
