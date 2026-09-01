import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

describe('service worker notification navigation', () => {
  it('keeps notification click targets on the Hava81 origin', () => {
    const source = readFileSync('public/sw.js', 'utf8');

    expect(source).toContain("self.addEventListener('notificationclick'");
    expect(source).toContain('new URL(event.notification.data?.url ||');
    expect(source).toContain('candidate.origin === self.location.origin');
    expect(source).toContain("let url = '/';");
    expect(source).toContain("return await client.focus();");
    expect(source).toContain("return self.clients.openWindow(url);");
    expect(source).toContain('A stale/unavailable client must not swallow the notification activation');
  });

  it('keeps navigations network-fresh across GitHub Pages deploys', () => {
    const source = readFileSync('public/sw.js', 'utf8');

    expect(source).toContain("const CACHE_NAME = 'hava81-shell-__HAVA81_BUILD_ID__'");
    expect(source).toContain("LEGACY_RELOAD_CACHE_NAMES = new Set(['hava81-shell-v1', 'hava81-shell-v2'])");
    expect(source).toContain("fetch(request, { cache: 'no-store' })");
    expect(source).toContain("fetch('/', { cache: 'no-store' })");
    expect(source).toContain("fetch(path, { cache: 'no-store' })");
    expect(source).toContain('Do not activate a new versioned worker without a complete offline boot shell');
    expect(source).toContain('Optional metadata must not block an otherwise usable shell upgrade');
    expect(source).toContain("client.navigate(client.url)");
  });

  it('normalizes navigation cache keys so query variants do not multiply offline shells', async () => {
    const source = readFileSync('public/sw.js', 'utf8');
    type TestWorkerEvent = {
      request?: { method: string; mode: string; destination: string; url: string };
      respondWith?: (promise: Promise<unknown>) => void;
    };
    const listeners = new Map<string, (event: TestWorkerEvent) => void>();
    const cachePut = vi.fn().mockResolvedValue(undefined);
    const cacheMatch = vi.fn().mockResolvedValue(undefined);
    const response = { ok: true, clone: vi.fn(() => ({ ok: true })) };
    let responsePromise: Promise<unknown> | undefined;

    runInNewContext(source, {
      self: {
        location: { origin: 'https://hava81.example' },
        clients: {},
        skipWaiting: vi.fn(),
        addEventListener: (name: string, listener: (event: TestWorkerEvent) => void) => {
          listeners.set(name, listener);
        },
      },
      caches: {
        open: vi.fn().mockResolvedValue({ put: cachePut, match: cacheMatch }),
        keys: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(true),
      },
      fetch: vi.fn().mockResolvedValue(response),
      URL,
      Set,
      Error,
    });

    listeners.get('fetch')?.({
      request: {
        method: 'GET',
        mode: 'navigate',
        destination: 'document',
        url: 'https://hava81.example/istanbul/?utm_source=share&v=2',
      },
      respondWith: (promise: Promise<unknown>) => {
        responsePromise = promise;
      },
    });

    await expect(responsePromise).resolves.toBe(response);
    expect(cachePut).toHaveBeenCalledWith('https://hava81.example/istanbul/', expect.anything());
  });

  it('caches any visited hashed application asset for resilient repeat/offline use', () => {
    const source = readFileSync('public/sw.js', 'utf8');

    expect(source).toContain("url.pathname.startsWith('/assets/')");
    expect(source).toContain("['script', 'style', 'font', 'image'].includes(request.destination)");
    expect(source).not.toContain('CORE_SCRIPT_PATTERN');
    expect(source).toContain('caches.open(CACHE_NAME)');
    expect(source).toContain('cache.match(request)');
    expect(source).not.toContain('caches.match(request)');
  });

  it('pre-caches the root boot assets required for a first offline launch', async () => {
    const source = readFileSync('public/sw.js', 'utf8');
    const listeners = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>();
    const cachePut = vi.fn().mockResolvedValue(undefined);
    const rootHtml = `
      <link href="/assets/index-def.css" rel="stylesheet">
      <link rel="modulepreload" href="/assets/vendor-123.js">
      <link rel="icon" href="/assets/icon.png">
      <script type="module" src="/assets/index-abc.js"></script>
      <script src="https://third-party.example/external.js"></script>
    `;
    const rootClone = vi.fn(() => ({ ok: true, text: vi.fn().mockResolvedValue(rootHtml) }));
    const assetResponse = () => ({ ok: true, clone: vi.fn(() => ({ ok: true })) });
    const manifestResponse = { ok: true, clone: vi.fn(() => ({ ok: true })) };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, clone: rootClone })
      .mockResolvedValueOnce(assetResponse())
      .mockResolvedValueOnce(assetResponse())
      .mockResolvedValueOnce(assetResponse())
      .mockResolvedValueOnce(manifestResponse);
    let installPromise: Promise<unknown> | undefined;

    runInNewContext(source, {
      self: {
        location: { origin: 'https://hava81.example' },
        clients: {},
        skipWaiting: vi.fn(),
        addEventListener: (name: string, listener: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void) => {
          listeners.set(name, listener);
        },
      },
      caches: {
        open: vi.fn().mockResolvedValue({ put: cachePut }),
        keys: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(true),
      },
      fetch: fetchMock,
      URL,
      Set,
      Error,
    });

    listeners.get('install')?.({ waitUntil: promise => { installPromise = promise; } });

    await expect(installPromise).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/assets/index-def.css', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/assets/vendor-123.js', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/assets/index-abc.js', { cache: 'no-store' });
    expect(fetchMock).not.toHaveBeenCalledWith('/assets/icon.png', expect.anything());
    expect(fetchMock).not.toHaveBeenCalledWith('https://third-party.example/external.js', expect.anything());
    expect(cachePut).toHaveBeenCalledWith('/', expect.anything());
    expect(cachePut).toHaveBeenCalledWith('/assets/index-def.css', expect.anything());
    expect(cachePut).toHaveBeenCalledWith('/assets/vendor-123.js', expect.anything());
    expect(cachePut).toHaveBeenCalledWith('/assets/index-abc.js', expect.anything());
  });

  it('rejects a new worker when a required boot asset cannot be secured', async () => {
    const source = readFileSync('public/sw.js', 'utf8');
    const listeners = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>();
    const cachePut = vi.fn().mockResolvedValue(undefined);
    const rootClone = vi.fn(() => ({
      ok: true,
      text: vi.fn().mockResolvedValue('<script type="module" src="/assets/index-missing.js"></script>'),
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, clone: rootClone })
      .mockResolvedValueOnce({ ok: false, clone: vi.fn() });
    let installPromise: Promise<unknown> | undefined;

    runInNewContext(source, {
      self: {
        location: { origin: 'https://hava81.example' },
        clients: {},
        skipWaiting: vi.fn(),
        addEventListener: (name: string, listener: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void) => {
          listeners.set(name, listener);
        },
      },
      caches: {
        open: vi.fn().mockResolvedValue({ put: cachePut }),
        keys: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(true),
      },
      fetch: fetchMock,
      URL,
      Set,
      Error,
    });

    listeners.get('install')?.({ waitUntil: promise => { installPromise = promise; } });

    await expect(installPromise).rejects.toThrow('Hava81 boot asset unavailable: /assets/index-missing.js');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cachePut).toHaveBeenCalledTimes(1);
    expect(cachePut).toHaveBeenCalledWith('/', expect.anything());
  });

  it('finishes install when optional manifest caching fails after the root is secured', async () => {
    const source = readFileSync('public/sw.js', 'utf8');
    const listeners = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>();
    const cachePut = vi.fn().mockResolvedValue(undefined);
    const clone = vi.fn(() => ({ ok: true, text: vi.fn().mockResolvedValue('<html></html>') }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, clone })
      .mockRejectedValueOnce(new Error('temporary manifest failure'));
    let installPromise: Promise<unknown> | undefined;

    runInNewContext(source, {
      self: {
        location: { origin: 'https://hava81.example' },
        clients: {},
        skipWaiting: vi.fn(),
        addEventListener: (name: string, listener: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void) => {
          listeners.set(name, listener);
        },
      },
      caches: {
        open: vi.fn().mockResolvedValue({ put: cachePut }),
        keys: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(true),
      },
      fetch: fetchMock,
      URL,
      Set,
      Error,
    });

    listeners.get('install')?.({
      waitUntil: promise => {
        installPromise = promise;
      },
    });

    await expect(installPromise).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/manifest.json', { cache: 'no-store' });
    expect(cachePut).toHaveBeenCalledTimes(1);
    expect(cachePut).toHaveBeenCalledWith('/', expect.anything());
  });

  it('rejects install when the root shell cannot be secured', async () => {
    const source = readFileSync('public/sw.js', 'utf8');
    const listeners = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>();
    const cachePut = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('root unavailable'));
    let installPromise: Promise<unknown> | undefined;

    runInNewContext(source, {
      self: {
        location: { origin: 'https://hava81.example' },
        clients: {},
        skipWaiting: vi.fn(),
        addEventListener: (name: string, listener: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void) => {
          listeners.set(name, listener);
        },
      },
      caches: {
        open: vi.fn().mockResolvedValue({ put: cachePut }),
        keys: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(true),
      },
      fetch: fetchMock,
      URL,
      Set,
      Error,
    });

    listeners.get('install')?.({
      waitUntil: promise => {
        installPromise = promise;
      },
    });

    await expect(installPromise).rejects.toThrow('root unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cachePut).not.toHaveBeenCalled();
  });
});
