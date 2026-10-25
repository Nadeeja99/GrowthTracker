'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

// Open dialogs, innermost last; only the topmost one reacts to keys.
const openDialogs: HTMLElement[] = [];

// The last element focused outside any open dialog. A dialog's opener can't be
// read from document.activeElement on mount, because React has already moved
// focus to an `autoFocus` field inside the dialog by then.
let lastFocusedOutside: HTMLElement | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', event => {
    const target = event.target;
    // Checked against the DOM (not openDialogs): autoFocus fires before a dialog registers.
    if (target instanceof HTMLElement && !target.closest('[aria-modal="true"]')) {
      lastFocusedOutside = target;
    }
  });
}

const focusablesIn = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement);

/**
 * Modal dialog behaviour for the element the returned ref is attached to:
 * moves focus inside on open (keeping any autoFocus), traps Tab/Shift+Tab,
 * closes on Escape, locks page scroll, and returns focus to whatever opened
 * it when it closes. Pair with role="dialog", aria-modal and aria-labelledby.
 */
export function useDialog<T extends HTMLElement>(onClose: () => void, active = true) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const panel = ref.current;
    if (!active || !panel) return;

    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const opener = focused && !panel.contains(focused) ? focused : lastFocusedOutside;
    openDialogs.push(panel);
    if (!panel.contains(document.activeElement)) {
      (focusablesIn(panel)[0] ?? panel).focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== panel) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusablesIn(panel);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openDialogs.splice(openDialogs.indexOf(panel), 1);
      if (openDialogs.length === 0) document.body.style.overflow = previousOverflow;
      // Return focus to the control that opened the dialog, if it's still on the page.
      if (opener?.isConnected) opener.focus();
    };
  }, [active]);

  return ref;
}
