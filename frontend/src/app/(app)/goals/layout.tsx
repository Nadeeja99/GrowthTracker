import type { Metadata } from 'next';

// Pages in this app are client components, which can't export metadata.
export const metadata: Metadata = { title: 'Goals' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
