/**
 * Faz 3.2: istek iptali (AbortController) ve paylaşılan (single-flight) istekler.
 */
import { vi, type Mock } from 'vitest';
import { httpClient, isAbortError } from '../../api/httpClient';

const originalFetch = global.fetch;

const okResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

/** fetch'i, kendi signal'i iptal edilince AbortError ile reddeden askıda bir istekle değiştirir. */
const pendingFetch = () => {
  let resolve!: (response: Response) => void;
  const signals: AbortSignal[] = [];
  (global.fetch as Mock).mockImplementation(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((resolveFetch, reject) => {
        signals.push(init.signal as AbortSignal);
        resolve = resolveFetch;
        init.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })
  );
  return { signals, resolve: (body: unknown) => resolve(okResponse(body)) };
};

describe('httpClient request cancellation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    httpClient.clearCache();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('rejects with AbortError (not a timeout) and aborts the network request', async () => {
    const { signals } = pendingFetch();
    const controller = new AbortController();

    const request = httpClient.get(
      '/weather/bundle',
      { lat: 41.01 },
      { signal: controller.signal }
    );
    controller.abort();

    await expect(request).rejects.toSatisfy(isAbortError);
    expect(signals[0]?.aborted).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(httpClient.getCacheSize()).toBe(0);
  });

  it('rejects immediately for an already aborted signal without fetching', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      httpClient.get('/weather/current', { city: 'İzmir' }, { signal: controller.signal })
    ).rejects.toSatisfy(isAbortError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps a shared request alive while another subscriber still needs it', async () => {
    const { signals, resolve } = pendingFetch();
    const first = new AbortController();
    const second = new AbortController();

    const cancelled = httpClient.get('/weather/hourly', { lat: 41 }, { signal: first.signal });
    const kept = httpClient.get('/weather/hourly', { lat: 41 }, { signal: second.signal });
    first.abort();
    await expect(cancelled).rejects.toSatisfy(isAbortError);
    expect(signals[0]?.aborted).toBe(false);

    resolve({ ok: true });
    await expect(kept).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('never aborts a shared request that a signal-less caller is waiting for', async () => {
    const { signals, resolve } = pendingFetch();
    const controller = new AbortController();

    const plain = httpClient.get('/weather/forecast', { lat: 41 });
    const cancellable = httpClient.get(
      '/weather/forecast',
      { lat: 41 },
      { signal: controller.signal }
    );
    controller.abort();
    await expect(cancellable).rejects.toSatisfy(isAbortError);
    expect(signals[0]?.aborted).toBe(false);

    resolve({ daily: [] });
    await expect(plain).resolves.toEqual({ daily: [] });
  });

  it('starts a fresh request after every subscriber cancelled the previous one', async () => {
    pendingFetch();
    const controller = new AbortController();
    const cancelled = httpClient.get(
      '/weather/context',
      { lat: 41 },
      { signal: controller.signal }
    );
    controller.abort();
    await expect(cancelled).rejects.toSatisfy(isAbortError);

    (global.fetch as Mock).mockResolvedValue(okResponse({ provider: 'Open-Meteo' }));
    await expect(httpClient.get('/weather/context', { lat: 41 })).resolves.toEqual({
      provider: 'Open-Meteo',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('honours a per-request retry override so bundle failures fall back immediately', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);

    await expect(
      httpClient.get('/weather/bundle', { lat: 41 }, { retries: 0 })
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
