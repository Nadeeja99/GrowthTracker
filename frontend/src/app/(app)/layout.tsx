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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="px-4 md:px-6 py-4 md:py-6 pb-24 md:pb-6">{children}</main>
        <MobileNavigation />
        <AppQuickCapture />
        <FocusPanel />
      </div>
    </FocusProvider>
  );
}
