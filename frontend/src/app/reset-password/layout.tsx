import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Choose a new password',
  // The page URL carries a one-time token: never send it on as a referrer,
  // and keep the page out of search engines.
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
