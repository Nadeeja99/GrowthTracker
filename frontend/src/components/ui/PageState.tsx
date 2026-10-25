'use client';

import React from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';

interface QueryLike {
  isLoading: boolean;
  error: Error | null;
  refetch?: () => unknown;
}

/** Combines several queries into one loading/error status for a page. */
export function combineQueries(...queries: QueryLike[]) {
  const failed = queries.find(q => q.error);
  return {
    isLoading: queries.some(q => q.isLoading),
    error: failed?.error ?? null,
    retry: () => queries.forEach(q => q.error && q.refetch?.()),
  };
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24" role="status" aria-live="polite">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

export function PageError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="max-w-md mx-auto text-center py-24" role="alert">
      <AlertCircle className="w-10 h-10 mx-auto text-red-500" />
      <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Couldn&apos;t load this page</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error.message}</p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
      >
        <RotateCw className="w-4 h-4" /> Try again
      </button>
    </div>
  );
}
