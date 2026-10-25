'use client'; // Error boundaries must be Client Components

import { ErrorFallback } from '@/components/ui/ErrorFallback';

// Fallback for routes outside the signed-in shell (e.g. /auth).
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4">
      <ErrorFallback error={error} retry={retry} />
    </main>
  );
}
