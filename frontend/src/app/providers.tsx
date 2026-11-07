'use client';

import React, { useEffect, useState } from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Toaster } from '@/components/ui/Toaster';
import { ApiError } from '@/lib/api';
import { describeError, toast } from '@/lib/toast';
import { registerServiceWorker } from '@/lib/serviceWorker';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** What the mutation does, for error messages: "delete the task". */
      action?: string;
      /** Set when the calling UI shows its own inline error instead. */
      silent?: boolean;
    };
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser session; created lazily so it is never shared
  // between requests during server rendering.
  const [queryClient] = useState(() => new QueryClient({
    // A failed background refresh keeps showing the cached data, and says so.
    // (A first load that fails has no data, so the page shows its own error.)
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.state.data !== undefined) toast.error(`Couldn’t refresh your data. ${describeError(error)}`);
      },
    }),
    // Every failed save surfaces as a toast unless the UI handles it inline.
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silent) return;
        const action = mutation.meta?.action;
        toast.error(action ? `Couldn’t ${action}. ${describeError(error)}` : describeError(error));
      },
    }),
    defaultOptions: {
      // Fail at once with a clear message instead of waiting silently for a
      // connection. Check-ins, which do wait, have their own queue (lib/checkIns).
      mutations: { networkMode: 'always' },
      queries: {
        staleTime: 30_000,
        // Retry transient failures only; client errors (incl. 429) won't succeed on retry.
        retry: (failureCount, error) =>
          failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
        refetchOnWindowFocus: true,
      },
    },
  }));

  useEffect(() => {
    // It assumes it's online until told otherwise, and the app can open offline.
    onlineManager.setOnline(navigator.onLine);
    registerServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
