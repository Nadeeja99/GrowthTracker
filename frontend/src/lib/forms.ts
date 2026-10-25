import type { KeyboardEvent } from 'react';

/**
 * ⌘/Ctrl+Enter submits the form from any field, including multi-line
 * textareas where plain Enter inserts a newline. Attach as a form's onKeyDown.
 */
export function submitOnModEnter(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }
}
