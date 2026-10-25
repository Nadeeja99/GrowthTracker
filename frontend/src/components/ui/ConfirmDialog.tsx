'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDialog } from '@/hooks/useDialog';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | undefined>(undefined);

function ConfirmDialog({ options, onResult }: { options: ConfirmOptions; onResult: (ok: boolean) => void }) {
  const dialogRef = useDialog<HTMLDivElement>(() => onResult(false));
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onResult(false)}>
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={options.message ? 'confirm-message' : undefined}
        className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-6"
      >
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 id="confirm-title" className="font-semibold text-gray-900 dark:text-white">{options.title}</h2>
            {options.message && (
              <p id="confirm-message" className="mt-1 text-sm text-gray-500 dark:text-gray-400">{options.message}</p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          {/* Cancel comes first so it receives initial focus: the safe default. */}
          <button
            onClick={() => onResult(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={() => onResult(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700"
          >
            {options.confirmLabel ?? 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Provides `useConfirm()`: an accessible, promise-based replacement for window.confirm. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>(next => {
    setOptions(next);
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
    });
  }, []);

  const finish = (ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && <ConfirmDialog options={options} onResult={finish} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used within a ConfirmProvider');
  return confirm;
}
