import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

describe('service worker install and navigation caching', () => {
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

  it('pre-caches the root boot assets required for a first offline launch', async () => {
    const source = readFileSync('public/sw.js', 'utf8');
    const listeners = new Map<
      string,
      (event: { waitUntil: (promise: Promise<unknown>) => void }) => void
    >();
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
        addEventListener: (
          name: string,
          listener: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void
        ) => {
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
    expect(fetchMock).toHaveBeenCalledWith('/assets/index-def.css', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/assets/vendor-123.js', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/assets/index-abc.js', { cache: 'no-store' });
    expect(fetchMock).not.toHaveBeenCalledWith('/assets/icon.png', expect.anything());
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://third-party.example/external.js',
      expect.anything()
    );
    expect(cachePut).toHaveBeenCalledWith('/', expect.anything());
    expect(cachePut).toHaveBeenCalledWith('/assets/index-def.css', expect.anything());
    expect(cachePut).toHaveBeenCalledWith('/assets/vendor-123.js', expect.anything());
    expect(cachePut).toHaveBeenCalledWith('/assets/index-abc.js', expect.anything());
  });

  it('rejects a new worker when a required boot asset cannot be secured', async () => {
    const source = readFileSync('public/sw.js', 'utf8');
    const listeners = new Map<
      string,
      (event: { waitUntil: (promise: Promise<unknown>) => void }) => void
    >();
    const cachePut = vi.fn().mockResolvedValue(undefined);
    const cacheDelete = vi.fn().mockResolvedValue(true);
    const rootClone = vi.fn(() => ({
      ok: true,
      text: vi
        .fn()
        .mockResolvedValue('<script type="module" src="/assets/index-missing.js"></script>'),
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
        addEventListener: (
          name: string,
          listener: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void
        ) => {
          listeners.set(name, listener);
        },
      },
      caches: {
        open: vi.fn().mockResolvedValue({ put: cachePut }),
        keys: vi.fn().mockResolvedValue([]),
        delete: cacheDelete,
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

    await expect(installPromise).rejects.toThrow(
      'Hava81 boot asset unavailable: /assets/index-missing.js'
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cachePut).toHaveBeenCalledTimes(1);
    expect(cachePut).toHaveBeenCalledWith('/', expect.anything());
    expect(cacheDelete).toHaveBeenCalledWith('hava81-shell-__HAVA81_BUILD_ID__');
  });

  it('finishes install when optional manifest caching fails after the root is secured', async () => {
    const source = readFileSync('public/sw.js', 'utf8');
    const listeners = new Map<
      string,
      (event: { waitUntil: (promise: Promise<unknown>) => void }) => void
    >();
    const cachePut = vi.fn().mockResolvedValue(undefined);
    const cacheDelete = vi.fn().mockResolvedValue(true);
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
        addEventListener: (
          name: string,
          listener: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void
        ) => {
          listeners.set(name, listener);
        },
      },
      caches: {
        open: vi.fn().mockResolvedValue({ put: cachePut }),
        keys: vi.fn().mockResolvedValue([]),
        delete: cacheDelete,
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
    expect(cacheDelete).not.toHaveBeenCalled();
  });

  it('preserves the root error when cache cleanup also fails', async () => {
    const source = readFileSync('public/sw.js', 'utf8');
    const listeners = new Map<
      string,
      (event: { waitUntil: (promise: Promise<unknown>) => void }) => void
    >();
    const cachePut = vi.fn().mockResolvedValue(undefined);
    const cacheDelete = vi.fn().mockRejectedValueOnce(new Error('cache cleanup denied'));
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('root unavailable'));
    let installPromise: Promise<unknown> | undefined;

    runInNewContext(source, {
      self: {
        location: { origin: 'https://hava81.example' },
        clients: {},
        skipWaiting: vi.fn(),
        addEventListener: (
          name: string,
          listener: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void
        ) => {
          listeners.set(name, listener);
        },
      },
      caches: {
        open: vi.fn().mockResolvedValue({ put: cachePut }),
        keys: vi.fn().mockResolvedValue([]),
        delete: cacheDelete,
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
    expect(cacheDelete).toHaveBeenCalledWith('hava81-shell-__HAVA81_BUILD_ID__');
  });
});
