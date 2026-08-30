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
