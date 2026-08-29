import { vi, type Mock } from 'vitest';
import { httpClient } from '../../api/httpClient';
import { ErrorCode } from '../../types';

const originalFetch = global.fetch;

const mockResponse = (body: unknown, init: { ok?: boolean; status?: number } = {}) =>
  ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
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
