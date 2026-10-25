'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorFallbackProps {
  error: unknown;
  retry: () => void;
}

/** Shared UI for route error boundaries: explain, offer a retry and a way out. */
export function ErrorFallback({ error, retry }: ErrorFallbackProps) {
  useEffect(() => {
    // Phase 7: report to an error tracker instead of only the console.
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && 'digest' in error ? String(error.digest) : null;

  return (
    <div className="max-w-md mx-auto text-center py-24" role="alert">
      <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
      <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        This part of the page hit an unexpected error. Your data is safe; try again, or head back to Today.
      </p>
      {digest && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Reference: {digest}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={() => retry()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
        >
          <RotateCw className="w-4 h-4" /> Try again
        </button>
        <Link
          href="/today"
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Go to Today
        </Link>
      </div>
    </div>
  );
}
