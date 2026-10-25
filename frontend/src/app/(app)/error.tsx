'use client'; // Error boundaries must be Client Components

import { ErrorFallback } from '@/components/ui/ErrorFallback';

// Catches render errors inside a page while keeping the header and navigation usable.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorFallback error={error} retry={retry} />;
}
