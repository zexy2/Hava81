const CACHE_NAME = 'hava81-shell-ddea99daded8';
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
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
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
    } catch (error) {
      // A failed install must not leave a partial versioned shell consuming Cache Storage.
      // Preserve the original install error even if best-effort cleanup itself fails.
      try {
        await caches.delete(CACHE_NAME);
      } catch {
        // The rejected install still preserves the previous active worker.
      }
      throw error;
    }
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Cache cleanup is housekeeping, not a prerequisite for activating a fully installed shell.
    // If storage enumeration/deletion is temporarily unavailable, keep the new worker usable and
    // leave any undeleted old cache for a later activation to retry.
    let keys = [];
    try {
      keys = await caches.keys();
    } catch {
      // Continue activation; the complete current shell was secured during install.
    }
    const oldShellKeys = keys.filter(
      key => key.startsWith('hava81-shell-') && key !== CACHE_NAME
    );
    const upgradingLegacyShell = oldShellKeys.some(key => LEGACY_RELOAD_CACHE_NAMES.has(key));
    await Promise.all(
      oldShellKeys.map(async key => {
        try {
          await caches.delete(key);
        } catch {
          // A stale cache may remain, but it must not block clients from using the new worker.
        }
      })
    );
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

async function cachedNavigationFallback(navigationCacheKey) {
  try {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(navigationCacheKey)) || (await cache.match('/'));
  } catch {
    // Cache Storage is optional during runtime; callers preserve the original network result.
    return undefined;
  }
}

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
            try {
              const cache = await caches.open(CACHE_NAME);
              await cache.put(navigationCacheKey, response.clone());
            } catch {
              // Runtime cache writes are best-effort; never discard a successful navigation.
            }
            return response;
          }

          // A transient server failure should not discard an already-cached application shell.
          // Keep 4xx responses network-authentic so missing routes are not hidden by stale HTML.
          if (response.status >= 500) {
            const cached = await cachedNavigationFallback(navigationCacheKey);
            if (cached) return cached;
          }
          return response;
        })
        .catch(async networkError => {
          const cached = await cachedNavigationFallback(navigationCacheKey);
          if (cached) return cached;
          throw networkError;
        })
    );
    return;
  }

  const cacheableStaticAsset =
    url.pathname.startsWith('/assets/') &&
    ['script', 'style', 'font', 'image'].includes(request.destination);
  if (!cacheableStaticAsset) return;

  event.respondWith((async () => {
    let cache;
    try {
      cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
    } catch {
      // Cache Storage may be disabled or quota-limited. Keep the network path available.
      cache = undefined;
    }

    const response = await fetch(request);
    if (response.ok && cache) {
      try {
        await cache.put(request, response.clone());
      } catch {
        // A cache write failure must not break a successfully fetched script/style/font/image.
      }
    }
    return response;
  })());
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
