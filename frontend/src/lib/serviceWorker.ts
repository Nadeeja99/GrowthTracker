const REGISTER_DELAY_MS = 1000;

/** Offline support and push notifications; development is left alone so hot reload works. */
export function registerServiceWorker(): void {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
  const version = process.env.NEXT_PUBLIC_RELEASE || 'local';
  // After the page has settled: installing downloads the other pages too.
  setTimeout(() => {
    navigator.serviceWorker.register(`/sw.js?v=${version}`, { scope: '/', updateViaCache: 'none' }).catch(() => undefined);
  }, REGISTER_DELAY_MS);
}
