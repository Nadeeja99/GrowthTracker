// Saves the plan on this device, so the app opens straight away and works
// without a connection. Only what the check-in screens need is stored: not
// reviews, coach conversations or anything else. It's removed on sign-out.
import { get, set, del } from 'idb-keyval';
import type { Query, QueryClient } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSubscribe, type PersistedClient, type Persister } from '@tanstack/react-query-persist-client';
import type { User } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

const CACHE_KEY = 'growthtracker-cache';
const USER_KEY = 'growthtracker-offline-user';
const SAVE_DELAY_MS = 1000;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
// Bump when the shape of cached data changes.
const FORMAT = '1';

const SAVED_QUERIES: string[] = [queryKeys.goals, queryKeys.tasks, queryKeys.schedules, queryKeys.habits].map(key => key[0]);

let saveTimer: ReturnType<typeof setTimeout> | undefined;

const persister: Persister = {
  persistClient(client: PersistedClient) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => set(CACHE_KEY, client).catch(() => undefined), SAVE_DELAY_MS);
  },
  restoreClient: () => get<PersistedClient>(CACHE_KEY),
  removeClient() {
    clearTimeout(saveTimer);
    return del(CACHE_KEY);
  },
};

// A different user's cache never matches, so it's discarded rather than shown.
const buster = (userId: string) => `${FORMAT}:${userId}`;

/** Who was signed in here last, so the app can open before the server answers. */
export function rememberedUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function rememberUser(user: User): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Storage is off or full: the app still works, just not offline.
  }
}

export async function restoreCache(queryClient: QueryClient, userId: string): Promise<void> {
  try {
    await persistQueryClientRestore({ queryClient, persister, maxAge: MAX_AGE_MS, buster: buster(userId) });
  } catch {
    // A damaged cache only costs the wait for fresh data.
  }
}

/** Keeps the saved copy current until the returned function is called. */
export function startCaching(queryClient: QueryClient, userId: string): () => void {
  return persistQueryClientSubscribe({
    queryClient,
    persister,
    buster: buster(userId),
    dehydrateOptions: {
      shouldDehydrateQuery: (query: Query) => query.state.status === 'success' && SAVED_QUERIES.includes(String(query.queryKey[0])),
    },
  });
}

/** Removes everything this file stored. */
export async function clearOfflineData(): Promise<void> {
  try {
    localStorage.removeItem(USER_KEY);
    await persister.removeClient();
  } catch {
    // Storage is off, so there's nothing to remove.
  }
}
