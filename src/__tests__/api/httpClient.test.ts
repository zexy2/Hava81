import { vi, type Mock } from 'vitest';
import { httpClient } from '../../api/httpClient';
import { config } from '../../config';
import { ErrorCode } from '../../types';

const originalFetch = global.fetch;

const mockResponse = (
  body: unknown,
  init: { ok?: boolean; status?: number; headers?: Record<string, string> } = {}
) =>
  ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers(init.headers),
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

describe('httpClient BFF transport', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    httpClient.clearCache();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('builds a relative BFF URL and reuses a valid GET cache entry', async () => {
    (global.fetch as Mock).mockResolvedValue(mockResponse({ cityName: 'Izmir' }));

    const first = await httpClient.get('/weather/current', { city: 'Izmir', units: 'metric' });
    const second = await httpClient.get('/weather/current', { city: 'Izmir', units: 'metric' });

    expect(first).toEqual({ cityName: 'Izmir' });
    expect(second).toBe(first);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/weather/current?city=Izmir&units=metric',
      expect.objectContaining({ headers: {} })
    );
    expect(httpClient.getCacheSize()).toBe(1);
  });

  it('deduplicates concurrent identical GET requests and releases the single-flight entry', async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchPromise = new Promise<Response>(resolve => {
      resolveFetch = resolve;
    });
    (global.fetch as Mock)
      .mockReturnValueOnce(fetchPromise)
      .mockResolvedValueOnce(mockResponse({ cityName: 'Izmir', temperature: 24 }));

    const first = httpClient.get('/weather/current', { city: 'Izmir' });
    const second = httpClient.get('/weather/current', { city: 'Izmir' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    resolveFetch?.(mockResponse({ cityName: 'Izmir', temperature: 23 }));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { cityName: 'Izmir', temperature: 23 },
      { cityName: 'Izmir', temperature: 23 },
    ]);

    httpClient.clearCache();
    await expect(httpClient.get('/weather/current', { city: 'Izmir' })).resolves.toEqual({
      cityName: 'Izmir',
      temperature: 24,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('releases a failed single-flight GET so a later retry can make a new request', async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce(
        mockResponse({ error: { message: 'City unavailable' } }, { ok: false, status: 404 })
      )
      .mockResolvedValueOnce(mockResponse({ cityName: 'Izmir' }));

    const first = httpClient.get('/weather/current', { city: 'Izmir' });
    const second = httpClient.get('/weather/current', { city: 'Izmir' });

    await expect(first).rejects.toMatchObject({ statusCode: 404 });
    await expect(second).rejects.toMatchObject({ statusCode: 404 });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await expect(httpClient.get('/weather/current', { city: 'Izmir' })).resolves.toEqual({
      cityName: 'Izmir',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('bounds retained GET cache entries and evicts the oldest response', async () => {
    (global.fetch as Mock).mockImplementation(async (url: string) => mockResponse({ url }));

    for (let index = 0; index < 129; index += 1) {
      await httpClient.get('/weather/current', { city: `City-${index}` });
    }

    expect(httpClient.getCacheSize()).toBe(128);
    expect(global.fetch).toHaveBeenCalledTimes(129);

    await httpClient.get('/weather/current', { city: 'City-0' });
    expect(global.fetch).toHaveBeenCalledTimes(130);
    expect(httpClient.getCacheSize()).toBe(128);
  });

  it('drops expired cache entries when storing a new response', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-01T10:00:00Z'));
      (global.fetch as Mock).mockResolvedValue(mockResponse({ ok: true }));
      await httpClient.get('/weather/current', { city: 'Old-1' });
      await httpClient.get('/weather/current', { city: 'Old-2' });
      expect(httpClient.getCacheSize()).toBe(2);

      vi.setSystemTime(new Date(Date.now() + config.cache.ttl + 1));
      await httpClient.get('/weather/current', { city: 'Fresh' });
      expect(httpClient.getCacheSize()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not reuse provider evidence beyond its declared freshness window', async () => {
    vi.useFakeTimers();
    try {
      const fetchedAt = new Date('2026-09-02T05:00:00.000Z');
      vi.setSystemTime(fetchedAt);
      (global.fetch as Mock)
        .mockResolvedValueOnce(
          mockResponse({
            cityName: 'Izmir',
            temperature: 23,
            meta: { provider: 'OpenWeather', fetchedAt: fetchedAt.toISOString(), freshForSeconds: 60 },
          })
        )
        .mockResolvedValueOnce(
          mockResponse({
            cityName: 'Izmir',
            temperature: 22,
            meta: {
              provider: 'OpenWeather',
              fetchedAt: new Date(fetchedAt.getTime() + 60_001).toISOString(),
              freshForSeconds: 60,
            },
          })
        );

      await expect(httpClient.get('/weather/current', { city: 'Izmir' })).resolves.toMatchObject({
        temperature: 23,
      });
      vi.setSystemTime(new Date(fetchedAt.getTime() + 60_001));
      await expect(httpClient.get('/weather/current', { city: 'Izmir' })).resolves.toMatchObject({
        temperature: 22,
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    [
      'materially future fetchedAt',
      (now: Date) => ({
        fetchedAt: new Date(now.getTime() + 60_001).toISOString(),
        freshForSeconds: 60,
      }),
    ],
    ['missing freshness window', (now: Date) => ({ fetchedAt: now.toISOString() })],
    ['invalid fetchedAt', (_now: Date) => ({ fetchedAt: 'not-a-date', freshForSeconds: 60 })],
    [
      'oversized freshness window',
      (now: Date) => ({ fetchedAt: now.toISOString(), freshForSeconds: 86_401 }),
    ],
  ])('does not cache provider evidence with %s', async (_label, invalidMeta) => {
    vi.useFakeTimers();
    try {
      const now = new Date('2026-09-02T05:00:00.000Z');
      vi.setSystemTime(now);
      (global.fetch as Mock)
        .mockResolvedValueOnce(
          mockResponse({
            cityName: 'Izmir',
            temperature: 23,
            meta: { provider: 'OpenWeather', ...invalidMeta(now) },
          })
        )
        .mockResolvedValueOnce(
          mockResponse({
            cityName: 'Izmir',
            temperature: 22,
            meta: { provider: 'OpenWeather', fetchedAt: now.toISOString(), freshForSeconds: 60 },
          })
        );

      await expect(httpClient.get('/weather/current', { city: 'Izmir' })).resolves.toMatchObject({
        temperature: 23,
      });
      await expect(httpClient.get('/weather/current', { city: 'Izmir' })).resolves.toMatchObject({
        temperature: 22,
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(httpClient.getCacheSize()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ['zero freshness window', 0],
    ['negative freshness window', -1],
    ['null freshness window', null],
    ['string freshness window', '60'],
  ])('does not cache provider evidence with %s', async (_label, invalidFreshForSeconds) => {
    vi.useFakeTimers();
    try {
      const now = new Date('2026-09-02T05:00:00.000Z');
      vi.setSystemTime(now);
      (global.fetch as Mock)
        .mockResolvedValueOnce(
          mockResponse({
            cityName: 'Izmir',
            temperature: 23,
            meta: {
              provider: 'OpenWeather',
              fetchedAt: now.toISOString(),
              freshForSeconds: invalidFreshForSeconds,
            },
          })
        )
        .mockResolvedValueOnce(
          mockResponse({
            cityName: 'Izmir',
            temperature: 22,
            meta: { provider: 'OpenWeather', fetchedAt: now.toISOString(), freshForSeconds: 60 },
          })
        );

      await expect(httpClient.get('/weather/current', { city: 'Izmir' })).resolves.toMatchObject({
        temperature: 23,
      });
      await expect(httpClient.get('/weather/current', { city: 'Izmir' })).resolves.toMatchObject({
        temperature: 22,
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(httpClient.getCacheSize()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not reuse a cache entry after the client clock moves behind its timestamp', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-29T13:00:00Z'));
      (global.fetch as Mock)
        .mockResolvedValueOnce(mockResponse({ cityName: 'Izmir', temperature: 23 }))
        .mockResolvedValueOnce(mockResponse({ cityName: 'Izmir', temperature: 22 }));

      await expect(httpClient.get('/weather/current', { city: 'Izmir' })).resolves.toMatchObject({
        temperature: 23,
      });

      vi.setSystemTime(new Date('2026-08-29T12:59:00Z'));

      await expect(httpClient.get('/weather/current', { city: 'Izmir' })).resolves.toMatchObject({
        temperature: 22,
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('serializes JSON posts and sets their content type', async () => {
    (global.fetch as Mock).mockResolvedValue(mockResponse({ accepted: true }));

    await expect(httpClient.post('/events', { city: 'Izmir' })).resolves.toEqual({
      accepted: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/events',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ city: 'Izmir' }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(httpClient.getCacheSize()).toBe(0);
  });

  it('uses the structured BFF error message without retrying a 404', async () => {
    (global.fetch as Mock).mockResolvedValue(
      mockResponse(
        { error: { code: 'LOCATION_NOT_FOUND', message: 'City is outside Turkey' } },
        { ok: false, status: 404 }
      )
    );

    await expect(httpClient.get('/weather/current', { city: 'Missing' })).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
      message: 'City is outside Turkey',
      retryable: false,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('honors a bounded Retry-After delay before retrying a temporary service failure', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      (global.fetch as Mock)
        .mockResolvedValueOnce(
          mockResponse(
            { error: { message: 'Service unavailable' } },
            { ok: false, status: 503, headers: { 'Retry-After': '2' } }
          )
        )
        .mockResolvedValueOnce(mockResponse({ cityName: 'Bursa' }));

      const request = httpClient.get('/weather/current', { city: 'Bursa' });
      await vi.advanceTimersByTimeAsync(0);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1999);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await expect(request).resolves.toEqual({ cityName: 'Bursa' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('honors an HTTP-date Retry-After hint for a retryable response', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      vi.setSystemTime(new Date('2026-08-30T01:30:00Z'));
      (global.fetch as Mock)
        .mockResolvedValueOnce(
          mockResponse(
            { error: { message: 'Service unavailable' } },
            {
              ok: false,
              status: 503,
              headers: { 'Retry-After': 'Sun, 30 Aug 2026 01:30:03 GMT' },
            }
          )
        )
        .mockResolvedValueOnce(mockResponse({ cityName: 'Bursa' }));

      const request = httpClient.get('/weather/current', { city: 'Bursa' });
      await vi.advanceTimersByTimeAsync(2999);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await expect(request).resolves.toEqual({ cityName: 'Bursa' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('caps an excessive Retry-After hint at the existing retry-delay maximum', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      (global.fetch as Mock)
        .mockResolvedValueOnce(
          mockResponse(
            { error: { message: 'Service unavailable' } },
            { ok: false, status: 503, headers: { 'Retry-After': '120' } }
          )
        )
        .mockResolvedValueOnce(mockResponse({ cityName: 'Bursa' }));

      const request = httpClient.get('/weather/current', { city: 'Bursa' });
      await vi.advanceTimersByTimeAsync(29_999);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await expect(request).resolves.toEqual({ cityName: 'Bursa' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the timeout active while reading a successful response body', async () => {
    vi.useFakeTimers();
    try {
      (global.fetch as Mock).mockImplementation((_url: string, init?: RequestInit) =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => {
                const abortError = new Error('body read aborted');
                abortError.name = 'AbortError';
                reject(abortError);
              });
            }),
        } as Response)
      );

      const request = httpClient.get('/weather/current', { city: 'Izmir' });
      const rejection = expect(request).rejects.toMatchObject({
        code: ErrorCode.NETWORK_ERROR,
        retryable: true,
      });
      await vi.advanceTimersByTimeAsync(config.api.timeout);

      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats an aborted error-body read as a timeout instead of an HTTP response', async () => {
    vi.useFakeTimers();
    try {
      (global.fetch as Mock).mockImplementation((_url: string, init?: RequestInit) =>
        Promise.resolve({
          ok: false,
          status: 503,
          headers: new Headers(),
          json: () =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => {
                const abortError = new Error('error body read aborted');
                abortError.name = 'AbortError';
                reject(abortError);
              });
            }),
        } as Response)
      );

      const request = httpClient.get('/weather/current', { city: 'Izmir' });
      const rejection = expect(request).rejects.toMatchObject({
        code: ErrorCode.NETWORK_ERROR,
        retryable: true,
      });
      await vi.advanceTimersByTimeAsync(config.api.timeout);

      await rejection;
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries fetch TypeErrors without relying on browser-specific error text', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      (global.fetch as Mock)
        .mockRejectedValueOnce(new TypeError('Load failed'))
        .mockResolvedValueOnce(mockResponse({ cityName: 'Bursa' }));

      const request = httpClient.get('/weather/current', { city: 'Bursa' });
      await vi.advanceTimersByTimeAsync(0);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      await expect(request).resolves.toEqual({ cityName: 'Bursa' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('wraps unexpected transport failures as retryable network errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const transportError = new Error('socket closed');
    (global.fetch as Mock).mockRejectedValue(transportError);

    await expect(httpClient.get('/weather/current', { city: 'Bursa' })).rejects.toMatchObject({
      code: ErrorCode.NETWORK_ERROR,
      retryable: true,
    });
  });
});
