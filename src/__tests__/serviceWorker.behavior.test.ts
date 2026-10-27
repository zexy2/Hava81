import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

/**
 * Faz 3.4: the service worker is executed in a VM with fake `caches` / `clients` and its
 * listeners are driven with synthetic events, instead of matching strings in public/sw.js.
 */
const source = readFileSync('public/sw.js', 'utf8');
const ORIGIN = 'https://hava81.example';
const CURRENT = 'hava81-shell-__HAVA81_BUILD_ID__';

type Listener = (event: Record<string, unknown>) => void;

interface FakeClient {
  url: string;
  focus: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
}

function loadWorker({
  cacheKeys = [] as string[],
  clients = [] as FakeClient[],
  fetchImpl = vi.fn().mockResolvedValue({ ok: true, clone: () => ({ ok: true }) }),
  cached = undefined as unknown,
} = {}) {
  const listeners = new Map<string, Listener>();
  const cache = {
    put: vi.fn().mockResolvedValue(undefined),
    match: vi.fn().mockResolvedValue(cached),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(cacheKeys),
    delete: vi.fn().mockResolvedValue(true),
  };
  const workerClients = {
    claim: vi.fn().mockResolvedValue(undefined),
    matchAll: vi.fn().mockResolvedValue(clients),
    openWindow: vi.fn().mockResolvedValue(undefined),
  };
  runInNewContext(source, {
    self: {
      location: { origin: ORIGIN },
      clients: workerClients,
      skipWaiting: vi.fn(),
      addEventListener: (name: string, listener: Listener) => listeners.set(name, listener),
    },
    caches,
    fetch: fetchImpl,
    URL,
    Headers,
    Response,
    Set,
    Error,
    Promise,
  });

  const dispatch = async (name: string, event: Record<string, unknown>) => {
    let pending: Promise<unknown> | undefined;
    listeners.get(name)?.({
      ...event,
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
      respondWith: (promise: Promise<unknown>) => {
        pending = promise;
      },
    });
    return pending ? await pending : undefined;
  };

  return { dispatch, caches, cache, workerClients, fetchImpl };
}

const client = (url = `${ORIGIN}/`): FakeClient => ({
  url,
  focus: vi.fn().mockResolvedValue('focused'),
  navigate: vi.fn().mockResolvedValue(undefined),
});

describe('service worker activation', () => {
  it('deletes only older versioned Hava81 shell caches', async () => {
    const worker = loadWorker({
      cacheKeys: [
        CURRENT,
        'hava81-shell-abc123',
        'hava81-tiles',
        'hava81-weather-api',
        'other-app',
      ],
    });
    await worker.dispatch('activate', {});
    expect(worker.caches.delete.mock.calls.map(([key]) => key)).toEqual(['hava81-shell-abc123']);
    expect(worker.workerClients.claim).toHaveBeenCalled();
  });

  it('continues activation when an older shell cache cannot be deleted', async () => {
    const worker = loadWorker({ cacheKeys: [CURRENT, 'hava81-shell-stale'] });
    worker.caches.delete.mockRejectedValueOnce(new Error('cache cleanup denied'));

    await expect(worker.dispatch('activate', {})).resolves.toBeUndefined();
    expect(worker.caches.delete).toHaveBeenCalledWith('hava81-shell-stale');
    expect(worker.workerClients.claim).toHaveBeenCalled();
  });

  it('continues activation when cache enumeration is temporarily unavailable', async () => {
    const worker = loadWorker({ cacheKeys: ['hava81-shell-stale'] });
    worker.caches.keys.mockRejectedValueOnce(new Error('cache enumeration denied'));

    await expect(worker.dispatch('activate', {})).resolves.toBeUndefined();
    expect(worker.caches.delete).not.toHaveBeenCalled();
    expect(worker.workerClients.claim).toHaveBeenCalled();
  });

  it('reloads open tabs once when upgrading from a legacy shell worker', async () => {
    const tab = client(`${ORIGIN}/istanbul/`);
    const worker = loadWorker({ cacheKeys: ['hava81-shell-v2'], clients: [tab] });
    await worker.dispatch('activate', {});
    expect(tab.navigate).toHaveBeenCalledWith(`${ORIGIN}/istanbul/`);
  });

  it('keeps activation successful when legacy-tab enumeration fails', async () => {
    const worker = loadWorker({ cacheKeys: ['hava81-shell-v2'] });
    worker.workerClients.matchAll.mockRejectedValueOnce(new Error('client enumeration unavailable'));

    await expect(worker.dispatch('activate', {})).resolves.toBeUndefined();
    expect(worker.workerClients.claim).toHaveBeenCalled();
  });

  it('does not reload tabs for a regular versioned upgrade', async () => {
    const tab = client();
    const worker = loadWorker({ cacheKeys: ['hava81-shell-abc123'], clients: [tab] });
    await worker.dispatch('activate', {});
    expect(tab.navigate).not.toHaveBeenCalled();
  });
});

describe('service worker notification clicks', () => {
  const click = (url?: string) => ({
    notification: { close: vi.fn(), data: url === undefined ? undefined : { url } },
  });

  it('focuses an open window on the same-origin target path', async () => {
    const tab = client();
    const worker = loadWorker({ clients: [tab] });
    const event = click(`${ORIGIN}/ankara/?view=plan#saat`);
    await expect(worker.dispatch('notificationclick', event)).resolves.toBe('focused');
    expect(event.notification.close).toHaveBeenCalled();
    expect(tab.navigate).toHaveBeenCalledWith('/ankara/?view=plan#saat');
    expect(worker.workerClients.openWindow).not.toHaveBeenCalled();
  });

  it('never navigates to another origin', async () => {
    const worker = loadWorker();
    await worker.dispatch('notificationclick', click('https://evil.example/phish'));
    expect(worker.workerClients.openWindow).toHaveBeenCalledWith('/');
  });

  it('falls back to the app root for malformed data', async () => {
    const worker = loadWorker();
    await worker.dispatch('notificationclick', click('http://[bad'));
    expect(worker.workerClients.openWindow).toHaveBeenCalledWith('/');
  });

  it('opens the intended URL when every open window is stale', async () => {
    const stale = client();
    stale.navigate.mockRejectedValue(new Error('gone'));
    const worker = loadWorker({ clients: [stale] });
    await worker.dispatch('notificationclick', click('/izmir/'));
    expect(worker.workerClients.openWindow).toHaveBeenCalledWith('/izmir/');
  });
});

describe('service worker fetch strategy', () => {
  it('keeps navigations network-fresh and caches them under a query-free key', async () => {
    const worker = loadWorker();
    await worker.dispatch('fetch', {
      request: {
        method: 'GET',
        mode: 'navigate',
        destination: 'document',
        url: `${ORIGIN}/bursa/?v=2`,
      },
    });
    expect(worker.fetchImpl).toHaveBeenCalledWith(expect.anything(), { cache: 'no-store' });
    expect(worker.cache.put).toHaveBeenCalledWith(`${ORIGIN}/bursa/`, expect.anything());
  });

  it('serves the cached shell when the network is down', async () => {
    const worker = loadWorker({
      fetchImpl: vi.fn().mockRejectedValue(new Error('offline')),
      cached: 'cached-shell',
    });
    const response = await worker.dispatch('fetch', {
      request: {
        method: 'GET',
        mode: 'navigate',
        destination: 'document',
        url: `${ORIGIN}/bursa/`,
      },
    });
    expect(response).toBe('cached-shell');
  });

  it('falls back to a URL-neutral root shell for an unvisited city while offline', async () => {
    const networkError = new Error('offline');
    const worker = loadWorker({ fetchImpl: vi.fn().mockRejectedValue(networkError) });
    const rootShell = new Response('<html><div id="root"></div></html>', {
      status: 200,
      headers: {
        'content-type': 'text/html',
        'content-length': '36',
        'content-encoding': 'gzip',
        'transfer-encoding': 'chunked',
      },
    });
    worker.cache.match.mockResolvedValueOnce(undefined).mockResolvedValueOnce(rootShell);

    const response = await worker.dispatch('fetch', {
      request: {
        method: 'GET',
        mode: 'navigate',
        destination: 'document',
        url: `${ORIGIN}/en/ankara/`,
      },
    });

    expect(response).toBeInstanceOf(Response);
    const fallbackResponse = response as Response;
    expect(fallbackResponse.url).toBe('');
    expect(fallbackResponse.status).toBe(200);
    expect(fallbackResponse.headers.get('content-length')).toBeNull();
    expect(fallbackResponse.headers.get('content-encoding')).toBeNull();
    expect(fallbackResponse.headers.get('transfer-encoding')).toBeNull();
    await expect(fallbackResponse.text()).resolves.toContain('id="root"');
    expect(worker.cache.match).toHaveBeenNthCalledWith(1, `${ORIGIN}/en/ankara/`);
    expect(worker.cache.match).toHaveBeenNthCalledWith(2, '/');
  });

  it('caches hashed static assets from the versioned cache only', async () => {
    const worker = loadWorker();
    const request = {
      method: 'GET',
      mode: 'no-cors',
      destination: 'script',
      url: `${ORIGIN}/assets/index-abc.js`,
    };
    await worker.dispatch('fetch', { request });
    expect(worker.caches.open).toHaveBeenCalledWith(CURRENT);
    expect(worker.cache.match).toHaveBeenCalledWith(request);
    expect(worker.cache.put).toHaveBeenCalledWith(request, expect.anything());
  });

  it('returns a successful navigation response when runtime cache writes fail', async () => {
    const response = { ok: true, clone: vi.fn(() => ({ ok: true })) };
    const fetchImpl = vi.fn().mockResolvedValue(response);
    const worker = loadWorker({ fetchImpl });
    worker.cache.put.mockRejectedValueOnce(new Error('cache quota exceeded'));

    await expect(
      worker.dispatch('fetch', {
        request: {
          method: 'GET',
          mode: 'navigate',
          destination: 'document',
          url: `${ORIGIN}/istanbul/`,
        },
      })
    ).resolves.toBe(response);
  });

  it('serves the cached shell for a transient navigation server error', async () => {
    const serverError = { ok: false, status: 503 };
    const fetchImpl = vi.fn().mockResolvedValue(serverError);
    const worker = loadWorker({ fetchImpl, cached: 'cached-shell' });

    await expect(
      worker.dispatch('fetch', {
        request: {
          method: 'GET',
          mode: 'navigate',
          destination: 'document',
          url: `${ORIGIN}/istanbul/?campaign=1`,
        },
      })
    ).resolves.toBe('cached-shell');
    expect(worker.cache.match).toHaveBeenCalledWith(`${ORIGIN}/istanbul/`);
    expect(worker.cache.put).not.toHaveBeenCalled();
  });

  it('keeps a navigation server error when no cached shell is available', async () => {
    const serverError = { ok: false, status: 503 };
    const worker = loadWorker({ fetchImpl: vi.fn().mockResolvedValue(serverError) });

    await expect(
      worker.dispatch('fetch', {
        request: {
          method: 'GET',
          mode: 'navigate',
          destination: 'document',
          url: `${ORIGIN}/istanbul/`,
        },
      })
    ).resolves.toBe(serverError);
  });

  it('does not mask a missing route with the cached application shell', async () => {
    const notFound = { ok: false, status: 404 };
    const worker = loadWorker({
      fetchImpl: vi.fn().mockResolvedValue(notFound),
      cached: 'cached-shell',
    });

    await expect(
      worker.dispatch('fetch', {
        request: {
          method: 'GET',
          mode: 'navigate',
          destination: 'document',
          url: `${ORIGIN}/not-a-real-route/`,
        },
      })
    ).resolves.toBe(notFound);
    expect(worker.caches.open).not.toHaveBeenCalled();
  });

  it('returns a successful navigation when Cache Storage cannot be opened', async () => {
    const response = { ok: true, clone: vi.fn(() => ({ ok: true })) };
    const fetchImpl = vi.fn().mockResolvedValue(response);
    const worker = loadWorker({ fetchImpl });
    worker.caches.open.mockRejectedValueOnce(new Error('storage disabled'));

    await expect(
      worker.dispatch('fetch', {
        request: {
          method: 'GET',
          mode: 'navigate',
          destination: 'document',
          url: `${ORIGIN}/istanbul/`,
        },
      })
    ).resolves.toBe(response);
    expect(fetchImpl).toHaveBeenCalledWith(expect.anything(), { cache: 'no-store' });
  });

  it('returns a successful static asset when its runtime cache write fails', async () => {
    const response = { ok: true, clone: vi.fn(() => ({ ok: true })) };
    const fetchImpl = vi.fn().mockResolvedValue(response);
    const worker = loadWorker({ fetchImpl });
    worker.cache.put.mockRejectedValueOnce(new Error('cache quota exceeded'));
    const request = {
      method: 'GET',
      mode: 'no-cors',
      destination: 'script',
      url: `${ORIGIN}/assets/index-abc.js`,
    };

    await expect(worker.dispatch('fetch', { request })).resolves.toBe(response);
  });

  it('fetches static assets when Cache Storage cannot be opened', async () => {
    const response = { ok: true, clone: vi.fn(() => ({ ok: true })) };
    const fetchImpl = vi.fn().mockResolvedValue(response);
    const worker = loadWorker({ fetchImpl });
    worker.caches.open.mockRejectedValueOnce(new Error('storage disabled'));
    const request = {
      method: 'GET',
      mode: 'no-cors',
      destination: 'script',
      url: `${ORIGIN}/assets/index-abc.js`,
    };

    await expect(worker.dispatch('fetch', { request })).resolves.toBe(response);
    expect(fetchImpl).toHaveBeenCalledWith(request);
  });

  it('fetches static assets when a cached lookup fails', async () => {
    const response = { ok: true, clone: vi.fn(() => ({ ok: true })) };
    const fetchImpl = vi.fn().mockResolvedValue(response);
    const worker = loadWorker({ fetchImpl });
    worker.cache.match.mockRejectedValueOnce(new Error('cache read failed'));
    const request = {
      method: 'GET',
      mode: 'no-cors',
      destination: 'script',
      url: `${ORIGIN}/assets/index-abc.js`,
    };

    await expect(worker.dispatch('fetch', { request })).resolves.toBe(response);
    expect(fetchImpl).toHaveBeenCalledWith(request);
  });

  it('preserves the original network error when a navigation cache lookup fails', async () => {
    const networkError = new Error('offline');
    const worker = loadWorker({ fetchImpl: vi.fn().mockRejectedValue(networkError) });
    worker.cache.match.mockRejectedValueOnce(new Error('cache read failed'));

    await expect(
      worker.dispatch('fetch', {
        request: {
          method: 'GET',
          mode: 'navigate',
          destination: 'document',
          url: `${ORIGIN}/istanbul/`,
        },
      })
    ).rejects.toBe(networkError);
  });

  it('preserves the original network error when offline cache access also fails', async () => {
    const networkError = new Error('offline');
    const worker = loadWorker({ fetchImpl: vi.fn().mockRejectedValue(networkError) });
    worker.caches.open.mockRejectedValueOnce(new Error('storage disabled'));

    await expect(
      worker.dispatch('fetch', {
        request: {
          method: 'GET',
          mode: 'navigate',
          destination: 'document',
          url: `${ORIGIN}/istanbul/`,
        },
      })
    ).rejects.toBe(networkError);
  });

  it('rejects an offline navigation when neither its path nor root shell is cached', async () => {
    const networkError = new Error('offline');
    const worker = loadWorker({ fetchImpl: vi.fn().mockRejectedValue(networkError) });

    await expect(
      worker.dispatch('fetch', {
        request: {
          method: 'GET',
          mode: 'navigate',
          destination: 'document',
          url: `${ORIGIN}/istanbul/`,
        },
      })
    ).rejects.toBe(networkError);
  });

  it('leaves API calls, other origins and non-GET requests to the network', async () => {
    const worker = loadWorker();
    for (const request of [
      { method: 'GET', mode: 'cors', destination: '', url: `${ORIGIN}/api/v1/weather/current` },
      {
        method: 'GET',
        mode: 'cors',
        destination: 'script',
        url: 'https://cdn.example/assets/x.js',
      },
      { method: 'POST', mode: 'cors', destination: '', url: `${ORIGIN}/assets/x.js` },
    ]) {
      await expect(worker.dispatch('fetch', { request })).resolves.toBeUndefined();
    }
    expect(worker.caches.open).not.toHaveBeenCalled();
  });
});
