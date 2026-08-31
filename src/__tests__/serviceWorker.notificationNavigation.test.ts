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
    expect(source).toContain('Do not activate a new versioned worker without an offline navigation fallback');
    expect(source).toContain('Optional metadata must not block an otherwise usable shell upgrade');
    expect(source).toContain("client.navigate(client.url)");
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

  it('finishes install when optional manifest caching fails after the root is secured', async () => {
    const source = readFileSync('public/sw.js', 'utf8');
    const listeners = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>();
    const cachePut = vi.fn().mockResolvedValue(undefined);
    const clone = vi.fn(() => ({ ok: true }));
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
