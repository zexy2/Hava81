import { vi, type Mock } from 'vitest';
import { httpClient } from '../../api/httpClient';
import { weatherService } from '../../api/weatherService';
import { ErrorCode } from '../../types';
import { getCurrentWeatherFreshness } from '../../utils/currentWeatherFreshness';

vi.mock('../../api/httpClient', () => ({
  httpClient: {
    get: vi.fn(),
  },
}));

const mockGet = httpClient.get as Mock;

describe('weatherService current weather range validation', () => {
  it('rejects a fresh BFF current-weather response whose minimum exceeds its maximum', async () => {
    mockGet.mockResolvedValue({
      cityName: 'Izmir',
      country: 'TR',
      temperature: 22,
      feelsLike: 21,
      tempMin: 28,
      tempMax: 18,
      humidity: 65,
      pressure: 1015,
      visibility: 10000,
      windSpeed: 3.5,
      windDirection: 180,
      description: 'acik hava',
      icon: '01d',
      sunrise: '2026-07-14T02:45:00.000Z',
      sunset: '2026-07-14T17:35:00.000Z',
      timestamp: '2026-07-14T12:00:00.000Z',
      coordinates: { lat: 38.42, lon: 27.14 },
      clouds: 0,
      meta: {
        provider: 'OpenWeather',
        fetchedAt: '2026-07-14T12:00:01.000Z',
        timezoneOffsetSeconds: 10800,
        cacheStatus: 'MISS',
        freshForSeconds: 60,
      },
    });

    await expect(weatherService.getCurrentWeather({ city: 'Izmir' })).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });
});


describe('current observation timestamp contract', () => {
  const currentPayload = (overrides: Record<string, unknown> = {}) => {
    const { meta: metaOverrides, ...dataOverrides } = overrides;
    return {
      cityName: 'Izmir',
      country: 'TR',
      temperature: 22,
      feelsLike: 21,
      tempMin: 18,
      tempMax: 25,
      humidity: 65,
      pressure: 1015,
      visibility: 10000,
      windSpeed: 3.5,
      windDirection: 180,
      description: 'acik hava',
      icon: '01d',
      sunrise: '2026-07-14T02:45:00.000Z',
      sunset: '2026-07-14T17:35:00.000Z',
      timestamp: new Date().toISOString(),
      coordinates: { lat: 38.42, lon: 27.14 },
      clouds: 0,
      ...dataOverrides,
      meta: {
        provider: 'OpenWeather',
        fetchedAt: new Date().toISOString(),
        timezoneOffsetSeconds: 10800,
        cacheStatus: 'MISS',
        freshForSeconds: 300,
        ...(metaOverrides as Record<string, unknown> | undefined),
      },
    };
  };

  it('uses the provider sample timestamp when fetchedAt is fresh but the sample is stale', async () => {
    const now = Date.now();
    const sampleTime = new Date(now - 3 * 60 * 60_000 - 1_000).toISOString();
    mockGet.mockResolvedValue(
      currentPayload({
        timestamp: sampleTime,
        meta: { fetchedAt: new Date(now - 1_000).toISOString(), freshForSeconds: 300 },
      })
    );

    const result = await weatherService.getCurrentWeather({ city: 'Izmir' });

    expect(result.meta.observedAt).toEqual(new Date(sampleTime));
    expect(getCurrentWeatherFreshness(result.meta, now)).toMatchObject({
      fresh: false,
      status: 'stale',
      ageMinutes: 180,
      expiresInMs: null,
    });
  });

  it('rejects a malformed source observation timestamp', async () => {
    mockGet.mockResolvedValue(currentPayload({ meta: { observedAt: 'not-a-date' } }));

    await expect(weatherService.getCurrentWeather({ city: 'Izmir' })).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });

  it.each([
    ['current sample timestamp', { timestamp: '2026-07-14T12:00:00.000' }, 'current.timestamp'],
    [
      'current fetch timestamp',
      { meta: { fetchedAt: '2026-07-14T12:00:01.000' } },
      'current.meta.fetchedAt',
    ],
    [
      'current source observation timestamp',
      {
        timestamp: '2026-07-14T12:00:00.000Z',
        meta: { observedAt: '2026-07-14T12:00:00.000' },
      },
      'current.meta.observedAt',
    ],
  ])('rejects timezone-less %s', async (_label, overrides, field) => {
    mockGet.mockResolvedValue(currentPayload(overrides as Record<string, unknown>));

    await expect(weatherService.getCurrentWeather({ city: 'Izmir' })).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
      details: { field },
    });
  });

  it('accepts timezone-qualified current timestamps with an explicit UTC offset', async () => {
    const sampleTime = new Date(Date.now() - 30_000).toISOString().replace('Z', '+00:00');
    mockGet.mockResolvedValue(
      currentPayload({
        timestamp: sampleTime,
        meta: { fetchedAt: sampleTime, observedAt: sampleTime },
      })
    );

    const result = await weatherService.getCurrentWeather({ city: 'Izmir' });
    expect(result.meta.observedAt).toEqual(new Date(sampleTime));
  });

  it('rejects a source observation timestamp beyond the future-skew ceiling', async () => {
    const now = Date.now();
    mockGet.mockResolvedValue(
      currentPayload({
        timestamp: new Date(now + 45_000).toISOString(),
        meta: { observedAt: new Date(now + 90_000).toISOString() },
      })
    );

    await expect(weatherService.getCurrentWeather({ city: 'Izmir' })).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });

  it('revives a consistent explicit source observation timestamp', async () => {
    const sampleTime = new Date(Date.now() - 30_000).toISOString();
    mockGet.mockResolvedValue(
      currentPayload({ timestamp: sampleTime, meta: { observedAt: sampleTime } })
    );

    const result = await weatherService.getCurrentWeather({ city: 'Izmir' });

    expect(result.meta.observedAt).toEqual(new Date(sampleTime));
  });

  it('rejects source metadata that conflicts with the current sample timestamp', async () => {
    const now = Date.now();
    mockGet.mockResolvedValue(
      currentPayload({
        timestamp: new Date(now - 3 * 60 * 60_000).toISOString(),
        meta: { observedAt: new Date(now).toISOString() },
      })
    );

    await expect(weatherService.getCurrentWeather({ city: 'Izmir' })).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });
});
