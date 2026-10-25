import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeError, dismiss, toast, toastStore } from './toast';

afterEach(() => {
  toastStore.getSnapshot().forEach(t => dismiss(t.id));
  vi.useRealTimers();
});

describe('toast store', () => {
  it('returns referentially stable snapshots (required by useSyncExternalStore)', () => {
    // Regression: a fresh [] per call caused React's "infinite loop" warning.
    expect(toastStore.getServerSnapshot()).toBe(toastStore.getServerSnapshot());
    expect(toastStore.getSnapshot()).toBe(toastStore.getSnapshot());
    toast.error('boom');
    expect(toastStore.getSnapshot()).toBe(toastStore.getSnapshot());
  });

  it('notifies subscribers, collapses duplicates and auto-dismisses', () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const unsubscribe = toastStore.subscribe(listener);
    toast.error('Network down');
    toast.error('Network down');
    expect(toastStore.getSnapshot()).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(6000);
    expect(toastStore.getSnapshot()).toHaveLength(0);
    unsubscribe();
  });

  it('keeps at most four toasts', () => {
    for (let i = 0; i < 6; i++) toast.success(`saved ${i}`);
    expect(toastStore.getSnapshot().map(t => t.message)).toEqual(['saved 2', 'saved 3', 'saved 4', 'saved 5']);
  });
});

describe('describeError', () => {
  it('explains network failures in plain language', () => {
    expect(describeError(new TypeError('Failed to fetch'))).toMatch(/offline/);
    expect(describeError(new Error('Goal not found'))).toBe('Goal not found');
    expect(describeError('weird')).toBe('Something went wrong.');
  });
});
