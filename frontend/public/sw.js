// Keeps the app's pages and files on the device so it opens without a
// connection, and shows push notifications. It never stores API responses:
// the data shown offline is saved separately, per user (src/lib/offlineCache.ts).
//
// Written by hand rather than generated: Serwist and friends rely on webpack
// plugins, and Next.js builds with Turbopack. Registered as /sw.js?v=<release>,
// so each deploy installs a fresh copy.

const VERSION = new URL(self.location.href).searchParams.get('v') || 'local';
const CACHE = `growthtracker-${VERSION}`;

// Static shells with no user data. Anything else, /reset-password included
// (its links carry a token), is never stored.
const PAGES = ['/today', '/plan', '/goals', '/habits', '/insights', '/settings', '/auth'];
const FILES = ['/manifest.json', '/icon-192x192.png', '/icon-512x512.png'];

// How long a page may take before the saved copy is shown instead. A free
// server takes about a minute to wake, and that shouldn't mean a blank screen.
const PAGE_TIMEOUT_MS = 3000;

const STATIC_FILE = /\/_next\/static\/[^"'\\\s<>)]+/g;

async function savePage(cache, path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put(path, response);
  await Promise.allSettled([...new Set(html.match(STATIC_FILE) ?? [])].map(file => cache.add(file)));
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Best effort: one failed file mustn't stop the app from installing.
    await Promise.allSettled([...PAGES.map(path => savePage(cache, path)), ...FILES.map(file => cache.add(file))]);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('growthtracker-') && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

/** The network if it answers quickly, otherwise the saved copy. Either way the saved copy is refreshed. */
async function openPage(event, path) {
  const cache = await caches.open(CACHE);
  const network = fetch(event.request).then(async response => {
    if (response.ok) await cache.put(path, response.clone());
    return response;
  });
  event.waitUntil(network.catch(() => undefined));

  const saved = await cache.match(path);
  if (!saved) return network;

  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(saved), PAGE_TIMEOUT_MS); });
  try {
    const response = await Promise.race([network, timeout]);
    return response.ok ? response : saved;
  } catch {
    return saved;
  } finally {
    clearTimeout(timer);
  }
}

/** Build files have the hash of their content in the name, so a saved copy is never out of date. */
async function openStaticFile(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(openStaticFile(request));
  } else if (request.mode === 'navigate' && PAGES.includes(url.pathname)) {
    event.respondWith(openPage(event, url.pathname));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then(saved => saved ?? fetch(request)));
  }
});

self.addEventListener('push', event => {
  let message = {};
  try {
    message = event.data?.json() ?? {};
  } catch {
    // Browsers require a visible notification for every push, so show the default.
  }
  event.waitUntil(self.registration.showNotification(message.title || 'GrowthTracker', {
    body: message.body || 'Open GrowthTracker to see your day.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: message.tag,
    data: { url: message.url || '/today' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  // Only ever a page of this app, whatever the message said.
  const { pathname } = new URL(event.notification.data?.url ?? '/today', self.location.origin);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const [open] = windows;
    if (!open) return self.clients.openWindow(pathname);
    await open.focus();
    return open.navigate(pathname).catch(() => undefined);
  })());
});
