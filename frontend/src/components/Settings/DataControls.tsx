'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Download, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDialog } from '@/hooks/useDialog';
import { apiClient } from '@/lib/api';
import { toDateKey } from '@/lib/dates';
import { describeError, toast } from '@/lib/toast';
import { PasswordField } from '@/components/ui/PasswordField';

/** Saves everything stored about the user as a JSON file. */
async function downloadExport() {
  const data = await apiClient.exportData();
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `growthtracker-export-${toDateKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function DeleteAccountDialog({ onClose, onExport, exporting }: { onClose: () => void; onExport: () => void; exporting: boolean }) {
  const ref = useDialog<HTMLDivElement>(onClose);
  const router = useRouter();
  const { deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDeleting(true);
    try {
      await deleteAccount(password);
      toast.success('Your account and all its data were deleted.');
      router.replace('/auth');
    } catch (err) {
      setError(describeError(err));
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="relative w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl">
        <form onSubmit={submit}>
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <h2 id="delete-account-title" className="text-lg font-semibold text-gray-900 dark:text-white">Delete your account?</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 -mt-1 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-5 py-4 space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <p>This permanently deletes your goals, tasks, time blocks, habits, daily reviews, focus sessions and AI coach history. It can&apos;t be undone.</p>
            <p>
              Want a copy first?{' '}
              <button type="button" onClick={onExport} disabled={exporting} className="font-medium text-blue-700 dark:text-blue-300 underline disabled:opacity-60">
                {exporting ? 'Preparing…' : 'Download your data'}
              </button>
            </p>
            <PasswordField id="delete-password" label="Enter your password to confirm" value={password} onChange={setPassword} autoComplete="current-password" autoFocus />
            {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
            <p className="text-xs text-gray-500 dark:text-gray-400">Anonymous AI usage counts (no content) are kept to enforce daily limits.</p>
          </div>
          <div className="flex justify-end gap-2 px-5 pb-5">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button type="submit" disabled={!password || deleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Settings → Your data: download everything, or delete the account. */
export function DataControls() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const exportData = async () => {
    setExporting(true);
    try {
      await downloadExport();
      toast.success('Your data was downloaded.');
    } catch (err) {
      toast.error(`Couldn’t download your data. ${describeError(err)}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center space-x-3 mb-4">
        <Database className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your data</h2>
      </div>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Download everything GrowthTracker stores about you as one JSON file.
          </p>
          <button
            type="button"
            onClick={exportData}
            disabled={exporting}
            className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            {exporting ? 'Preparing…' : 'Download my data'}
          </button>
        </div>
        <div className="pt-5 border-t border-gray-100 dark:border-gray-700">
          {user?.isDemo ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">The shared demo account can&apos;t be deleted. It resets itself regularly.</p>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Permanently delete your account and everything in it.</p>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete account
              </button>
            </div>
          )}
        </div>
      </div>
      {confirmingDelete && <DeleteAccountDialog onClose={() => setConfirmingDelete(false)} onExport={exportData} exporting={exporting} />}
    </div>
  );
}
