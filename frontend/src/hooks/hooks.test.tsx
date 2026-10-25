import React, { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useTimer, type RecordedFocus } from './useTimer';
import { useDialog } from './useDialog';

afterEach(cleanup);

describe('useTimer', () => {
  beforeAll(() => {
    // jsdom has no media playback.
    window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  });
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 28, 9, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

  it('records a completed 25-minute focus session and moves to a break', () => {
    const recorded: RecordedFocus[] = [];
    const { result } = renderHook(() => useTimer({ onFocusRecorded: f => recorded.push(f) }));
    act(() => result.current.startTimer());
    advance(25 * 60_000 + 500);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ completed: true, durationSeconds: 1500, plannedSeconds: 1500 });
    expect(result.current.currentSession).toBe('break');
  });

  it('excludes paused time and records a partial session when reset', () => {
    const recorded: RecordedFocus[] = [];
    const { result } = renderHook(() => useTimer({ onFocusRecorded: f => recorded.push(f) }));
    act(() => result.current.startTimer());
    advance(10 * 60_000);
    act(() => result.current.pauseTimer());
    advance(5 * 60_000); // paused: must not count
    act(() => result.current.startTimer());
    advance(2 * 60_000);
    act(() => result.current.resetTimer());
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ completed: false, durationSeconds: 12 * 60 });
  });

  it('ignores interruptions shorter than a minute', () => {
    const onFocusRecorded = vi.fn();
    const { result } = renderHook(() => useTimer({ onFocusRecorded }));
    act(() => result.current.startTimer());
    advance(30_000);
    act(() => result.current.resetTimer());
    expect(onFocusRecorded).not.toHaveBeenCalled();
  });
});

describe('useDialog', () => {
  beforeAll(() => {
    // jsdom does no layout, so offsetParent is always null; treat everything as visible.
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', { get() { return this.parentNode; }, configurable: true });
  });

  function Dialog({ onClose }: { onClose: () => void }) {
    const ref = useDialog<HTMLDivElement>(onClose);
    return (
      <div ref={ref} role="dialog" aria-modal="true">
        <button>First</button>
        <button>Last</button>
      </div>
    );
  }

  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        {open && <Dialog onClose={() => setOpen(false)} />}
      </>
    );
  }

  it('moves focus in, traps Tab, closes on Escape and restores focus', () => {
    render(<Harness />);
    const opener = screen.getByText('Open');
    opener.focus();
    fireEvent.click(opener);

    expect(document.activeElement).toBe(screen.getByText('First'));
    screen.getByText('Last').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('First'));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText('Last'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
