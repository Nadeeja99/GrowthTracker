'use client'; // Error boundaries must be Client Components

// Last resort when the root layout itself fails. It replaces the whole
// document, so global CSS isn't loaded: styles are inline, and the colours
// follow the OS light/dark preference via `color-scheme`.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" style={{ colorScheme: 'light dark' }}>
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', padding: 16 }}>
        <title>Something went wrong · GrowthTracker</title>
        <main role="alert" style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ opacity: 0.75, margin: '0 0 24px', lineHeight: 1.5 }}>
            GrowthTracker couldn&apos;t load. Your data is safe. Please try again.
          </p>
          <button
            onClick={() => retry()}
            style={{ background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
