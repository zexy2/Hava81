const CACHE_NAME = 'hava81-shell-a9d4f569bad4';
const LEGACY_RELOAD_CACHE_NAMES = new Set(['hava81-shell-v1', 'hava81-shell-v2']);
const OPTIONAL_SHELL = ['/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Do not activate a new versioned worker without an offline navigation fallback.
      // Rejecting this install leaves the previous worker/cache authoritative until retry.
      const rootResponse = await fetch('/', { cache: 'no-store' });
      if (!rootResponse.ok) throw new Error('Hava81 shell root unavailable');
      await cache.put('/', rootResponse.clone());

      for (const path of OPTIONAL_SHELL) {
        try {
          const response = await fetch(path, { cache: 'no-store' });
          if (response.ok) await cache.put(path, response.clone());
        } catch {
          // Optional metadata must not block an otherwise usable shell upgrade.
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldShellKeys = keys.filter(key => key.startsWith('hava81-') && key !== CACHE_NAME);
    const upgradingLegacyShell = oldShellKeys.some(key => LEGACY_RELOAD_CACHE_NAMES.has(key));
    await Promise.all(oldShellKeys.map(key => caches.delete(key)));
    await self.clients.claim();

    // One-time migration from older shell workers: reload open Hava81 tabs so they stop rendering
    // HTML that the browser may still consider fresh for several minutes after a Pages deploy.
    if (upgradingLegacyShell) {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(
        windows.map(client =>
          'navigate' in client ? client.navigate(client.url).catch(() => undefined) : undefined
        )
      );
    }
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(async response => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(request)) || (await cache.match('/'));
        })
    );
    return;
  }

  const cacheableStaticAsset =
    url.pathname.startsWith('/assets/') &&
    ['script', 'style', 'font', 'image'].includes(request.destination);
  if (!cacheableStaticAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  let url = '/';
  try {
    const candidate = new URL(event.notification.data?.url || '/', self.location.origin);
    if (candidate.origin === self.location.origin) {
      url = `${candidate.pathname}${candidate.search}${candidate.hash}`;
    }
  } catch {
    // Malformed notification data falls back to the app root.
  }
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (!('focus' in client)) continue;
      try {
        if ('navigate' in client) await client.navigate(url);
        return await client.focus();
      } catch {
        // A stale/unavailable client must not swallow the notification activation.
        // Try another window, then fall back to opening the intended same-origin URL.
      }
    }
    return self.clients.openWindow(url);
  })());
});
