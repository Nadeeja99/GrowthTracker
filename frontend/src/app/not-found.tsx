import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">Page not found</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">That page doesn&apos;t exist or has moved.</p>
        <Link
          href="/today"
          className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
        >
          Go to Today
        </Link>
      </div>
    </main>
  );
}
