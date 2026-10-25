import React from 'react';
import { cn } from '@/lib/utils';

/** A placeholder block; pulses unless the user prefers reduced motion. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse motion-reduce:animate-none rounded-md bg-gray-200 dark:bg-gray-800', className)} />;
}

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 md:p-6', className)}>
    {children}
  </div>
);

const Rows = ({ count, height = 'h-12' }: { count: number; height?: string }) => (
  <div className="space-y-2">
    {Array.from({ length: count }, (_, i) => <Skeleton key={i} className={cn('w-full', height)} />)}
  </div>
);

/** Announces loading to assistive tech; the visual skeleton is hidden from it. */
function Loading({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">Loading {label}…</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function TodaySkeleton() {
  return (
    <Loading label="Today" className="max-w-3xl mx-auto">
      <div className="space-y-4 md:space-y-6">
        <Skeleton className="h-4 w-40 mt-2" />
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16" />)}</div>
        <Card><Skeleton className="h-5 w-40 mb-4" /><Rows count={3} /></Card>
        <Card><Skeleton className="h-5 w-28 mb-4" /><Rows count={2} /></Card>
      </div>
    </Loading>
  );
}

export function PlanSkeleton() {
  return (
    <Loading label="your plan">
      <div className="space-y-4 md:space-y-6">
        <Card><Skeleton className="h-7 w-32 mb-2" /><Skeleton className="h-4 w-56" /></Card>
        <div className="grid gap-4 md:gap-6 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <div className="grid grid-cols-7 gap-2">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-48" />)}</div>
          </Card>
          <div className="xl:col-span-2 space-y-3"><Rows count={4} height="h-24" /></div>
        </div>
      </div>
    </Loading>
  );
}

export function GoalsSkeleton() {
  return (
    <Loading label="goals">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map(i => (
          <Card key={i}><Skeleton className="h-5 w-40 mb-4" /><Skeleton className="h-3 w-full mb-3" /><Rows count={3} height="h-5" /></Card>
        ))}
      </div>
    </Loading>
  );
}

export function HabitsSkeleton() {
  return (
    <Loading label="habits">
      <div className="space-y-4 md:space-y-6">
        <Card><Skeleton className="h-7 w-32 mb-4" /><Skeleton className="h-10 w-full" /></Card>
        <Rows count={3} height="h-20" />
      </div>
    </Loading>
  );
}

export function InsightsSkeleton() {
  return (
    <Loading label="insights">
      <div className="space-y-4 md:space-y-6">
        <Card><Skeleton className="h-7 w-32 mb-4" /><Skeleton className="h-9 w-80 max-w-full" /></Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
        <Card><Skeleton className="h-64 w-full" /></Card>
      </div>
    </Loading>
  );
}
