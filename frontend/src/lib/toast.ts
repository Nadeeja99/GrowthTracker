// Minimal toast store that lives outside React, so non-component code (such as
// the query client's global mutation error handler) can raise notifications.

export interface Toast {
  id: number;
  kind: 'error' | 'success';
  message: string;
}

const AUTO_DISMISS_MS = 6000;
// Snapshots must be referentially stable for useSyncExternalStore: the store
// only replaces `toasts` when it changes, and the server snapshot is a constant.
const NO_TOASTS: Toast[] = [];
let toasts: Toast[] = NO_TOASTS;
let nextId = 1;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(listener => listener());

function push(kind: Toast['kind'], message: string) {
  // Collapse repeats (e.g. several requests failing while offline).
  if (toasts.some(t => t.kind === kind && t.message === message)) return;
  const toast = { id: nextId++, kind, message };
  toasts = [...toasts.slice(-3), toast];
  emit();
  setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
}

export function dismiss(id: number) {
  toasts = toasts.filter(t => t.id !== id);
  emit();
}

export const toast = {
  error: (message: string) => push('error', message),
  success: (message: string) => push('success', message),
};

export const toastStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => toasts,
  getServerSnapshot: () => NO_TOASTS,
};

/** Human-readable reason for a failed request. */
export function describeError(error: unknown): string {
  if (error instanceof TypeError) return 'You seem to be offline. Check your connection and try again.';
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong.';
}
