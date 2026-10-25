'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FocusProvider } from '@/contexts/FocusContext';
import { Header } from '@/components/Layout/Header';
import { MobileNavigation } from '@/components/Layout/MobileNavigation';
import { FocusPanel } from '@/components/Focus/FocusPanel';
import { QuickCapture } from '@/components/ui/QuickCapture';
import { PageLoader } from '@/components/ui/PageState';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import { useGoals } from '@/hooks/data/useGoals';
import { useTaskMutations } from '@/hooks/data/useTasks';
import { useScheduleMutations } from '@/hooks/data/useSchedules';
import { Task } from '@/types';

// Global quick-add (⌘/Ctrl+K), available on every page.
function AppQuickCapture() {
  const goals = useGoals().data ?? [];
  const tasks = useTaskMutations();
  const schedules = useScheduleMutations();

  return (
    <QuickCapture
      goals={goals}
      onCreateTask={async data => {
        await tasks.create.mutateAsync({
          title: data.title,
          priority: data.priority as Task['priority'],
          status: 'todo',
          tags: [],
          subtasks: [],
          goalId: data.goalId,
        });
      }}
      onCreateActivity={async data => {
        await schedules.create.mutateAsync({ ...data, status: 'pending' });
      }}
    />
  );
}

// Shell for every signed-in page. It persists across navigation, so the
// focus timer keeps running while you move between tabs.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/auth');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <PageLoader />
      </div>
    );
  }

  return (
    <FocusProvider>
      <ConfirmProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-white focus:text-gray-900 focus:shadow">Skip to content</a>
          <Header />
          {/* One centred column; bottom padding clears the mobile tab bar. */}
          <main id="main" tabIndex={-1} className="outline-none mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 md:pt-10 pb-28 md:pb-12">{children}</main>
          <MobileNavigation />
          <AppQuickCapture />
          <FocusPanel />
        </div>
      </ConfirmProvider>
    </FocusProvider>
  );
}
