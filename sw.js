const CACHE_NAME = 'hava81-shell-2998b93477cf';
const LEGACY_RELOAD_CACHE_NAMES = new Set(['hava81-shell-v1', 'hava81-shell-v2']);
const OPTIONAL_SHELL = ['/manifest.json'];

function extractBootAssetPaths(html) {
  const paths = new Set();
  for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const [tag, rawName] = match;
    const name = rawName.toLowerCase();
    if (name === 'link') {
      const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1]?.toLowerCase().split(/\s+/) || [];
      if (!rel.includes('stylesheet') && !rel.includes('modulepreload')) continue;
    }
    const attribute = name === 'script' ? 'src' : 'href';
    const rawPath = tag.match(new RegExp(`\\b${attribute}=["']([^"']+)["']`, 'i'))?.[1];
    if (!rawPath) continue;
    try {
      const assetUrl = new URL(rawPath, self.location.origin);
      if (assetUrl.origin === self.location.origin && assetUrl.pathname.startsWith('/assets/')) {
        paths.add(`${assetUrl.pathname}${assetUrl.search}`);
      }
    } catch {
      // Malformed tags are ignored; required valid boot assets are still cached below.
    }
  }
  return [...paths];
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Do not activate a new versioned worker without a complete offline boot shell.
      // Rejecting this install leaves the previous worker/cache authoritative until retry.
      const rootResponse = await fetch('/', { cache: 'no-store' });
      if (!rootResponse.ok) throw new Error('Hava81 shell root unavailable');
      const rootHtml = await rootResponse.clone().text();
      await cache.put('/', rootResponse.clone());

      for (const assetPath of extractBootAssetPaths(rootHtml)) {
        const response = await fetch(assetPath, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Hava81 boot asset unavailable: ${assetPath}`);
        await cache.put(assetPath, response.clone());
      }

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
    // Query parameters do not change Hava81's generated SPA/city shell. Normalize the
    // offline cache key so tracking/cache-bust variants cannot create unbounded copies.
    const navigationCacheKey = `${url.origin}${url.pathname}`;
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(async response => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(navigationCacheKey, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(navigationCacheKey)) || (await cache.match('/'));
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
