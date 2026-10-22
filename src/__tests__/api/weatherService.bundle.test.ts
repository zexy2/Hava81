/**
 * Faz 3.2: `/weather/bundle` ve `/weather/provinces` istemcisi.
 */
import { vi, type Mock } from 'vitest';
import { ApiError } from '../../api/errors/ApiError';
import { httpClient } from '../../api/httpClient';
import { BundleUnavailableError } from '../../api/weatherBundle';
import { resetEndpointSupportForTests, weatherService } from '../../api/weatherService';
import { ErrorCode } from '../../types';

vi.mock('../../api/httpClient', () => ({
  httpClient: { get: vi.fn() },
}));

const mockGet = httpClient.get as Mock;
const nowIso = () => new Date().toISOString();

const forecastPart = () => ({
  daily: [
    { date: '2026-07-14', tempMin: 18, tempMax: 27, icon: '01d', description: 'clear', pop: 5 },
  ],
  hourly: [
    {
      time: '2026-07-14T12:00:00.000Z',
      temp: 24,
      icon: '01d',
      pop: 5,
      description: 'clear',
      windSpeed: 3.2,
    },
  ],
  meta: {
    provider: 'OpenWeather',
    fetchedAt: nowIso(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 3,
    cacheStatus: 'MISS',
    freshForSeconds: 300,
  },
});

const hourlyPart = () => ({
  hourly: [
    {
      time: '2026-08-28T18:00:00.000Z',
      temp: 24,
      icon: '01d',
      description: 'açık',
      pop: 35,
      windSpeed: 3.2,
    },
  ],
  meta: {
    provider: 'Open-Meteo',
    fetchedAt: nowIso(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 1,
  },
});

const contextPart = () => ({
  provider: 'Open-Meteo',
  fetchedAt: nowIso(),
  attribution: 'Open-Meteo · CC BY 4.0',
  uvIndexMax: 6,
  units: {},
  cacheStatus: 'MISS',
  freshForSeconds: 1800,
});

describe('weatherService.getForecastBundle', () => {
  beforeEach(() => {
    mockGet.mockReset();
    resetEndpointSupportForTests();
  });

  it('requests every forecast part in one call and validates each part', async () => {
    mockGet.mockResolvedValue({
      forecast: forecastPart(),
      hourly: hourlyPart(),
      airQuality: null,
      context: contextPart(),
      errors: { airQuality: { code: 'PROVIDER_ERROR', message: 'down', statusCode: 502 } },
      meta: { fetchedAt: nowIso(), parts: ['forecast', 'hourly', 'airQuality', 'context'] },
    });
    const controller = new AbortController();

    const bundle = await weatherService.getForecastBundle(38.42, 27.14, 'en', {
      marine: true,
      signal: controller.signal,
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      '/weather/bundle',
      {
        lat: 38.42,
        lon: 27.14,
        units: 'metric',
        lang: 'en',
        marine: 'true',
        include: 'forecast,hourly,airQuality,context',
      },
      { signal: controller.signal, retries: 0 }
    );
    expect(bundle.forecast?.ok && bundle.forecast.value.daily[0].date).toBeInstanceOf(Date);
    expect(bundle.forecast?.ok && bundle.forecast.value.daily[0].pop).toBe(0.05);
    expect(bundle.hourly?.ok && bundle.hourly.value.meta.intervalHours).toBe(1);
    expect(bundle.context?.ok && bundle.context.value.uvIndexMax).toBe(6);
    expect(bundle.airQuality?.ok).toBe(false);
    const aqError = bundle.airQuality && !bundle.airQuality.ok ? bundle.airQuality.error : null;
    expect(aqError).toBeInstanceOf(ApiError);
    expect((aqError as ApiError).statusCode).toBe(502);
  });

  it('maps daylight: API isDay first, icon suffix as fallback, sunrise/sunset as Dates', async () => {
    const hourly = {
      ...hourlyPart(),
      daily: [
        {
          date: '2026-08-28',
          tempMin: 19,
          tempMax: 27,
          icon: '01d',
          description: 'açık',
          pop: 10,
          sunrise: '2026-08-28T03:31:00.000Z',
          sunset: '2026-08-28T16:40:00.000Z',
        },
        // Incoherent pair (sunset before sunrise) is dropped, not fatal.
        {
          date: '2026-08-29',
          tempMin: 19,
          tempMax: 27,
          icon: '01d',
          description: 'açık',
          pop: 10,
          sunrise: '2026-08-29T16:40:00.000Z',
          sunset: '2026-08-29T03:31:00.000Z',
        },
      ],
      hourly: [
        // The API says night even though an old icon cache could say day.
        { time: '2026-08-28T18:00:00.000Z', temp: 24, icon: '01d', description: 'açık', pop: 10, windSpeed: 3, isDay: false },
        // Older API revision: no isDay, icon suffix decides.
        { time: '2026-08-28T19:00:00.000Z', temp: 23, icon: '01n', description: 'açık', pop: 10, windSpeed: 3 },
        { time: '2026-08-28T20:00:00.000Z', temp: 23, icon: '02d', description: 'açık', pop: 10, windSpeed: 3 },
      ],
    };
    mockGet.mockResolvedValue({
      hourly,
      errors: {},
      meta: { fetchedAt: nowIso(), parts: ['hourly'] },
    });

    const bundle = await weatherService.getForecastBundle(41.01, 28.97, 'tr', { parts: ['hourly'] });

    expect(bundle.hourly?.ok).toBe(true);
    const value = bundle.hourly?.ok ? bundle.hourly.value : null;
    expect(value?.hourly.map(item => item.isDay)).toEqual([false, false, true]);
    expect(value?.daily?.[0].sunrise).toEqual(new Date('2026-08-28T03:31:00.000Z'));
    expect(value?.daily?.[0].sunset).toEqual(new Date('2026-08-28T16:40:00.000Z'));
    expect(value?.daily?.[1].sunrise).toBeUndefined();
    expect(value?.daily?.[1].sunset).toBeUndefined();
  });

  it('rejects a non-boolean isDay as a malformed hourly part', async () => {
    const hourly = hourlyPart();
    mockGet.mockResolvedValue({
      hourly: { ...hourly, hourly: [{ ...hourly.hourly[0], isDay: 1 }] },
      errors: {},
      meta: { fetchedAt: nowIso(), parts: ['hourly'] },
    });

    const bundle = await weatherService.getForecastBundle(41.01, 28.97, 'tr', { parts: ['hourly'] });

    expect(bundle.hourly?.ok).toBe(false);
  });

  it('marks a single malformed part as failed without discarding the others', async () => {
    const forecast = forecastPart();
    forecast.daily[0].pop = 140;
    mockGet.mockResolvedValue({
      forecast,
      hourly: hourlyPart(),
      errors: {},
      meta: { fetchedAt: nowIso(), parts: ['forecast', 'hourly'] },
    });

    const bundle = await weatherService.getForecastBundle(38.42, 27.14, 'tr', {
      parts: ['forecast', 'hourly'],
    });

    expect(mockGet.mock.calls[0][1].include).toBe('forecast,hourly');
    expect(mockGet.mock.calls[0][2]).toEqual({ retries: 0 });
    expect(bundle.forecast?.ok).toBe(false);
    expect(bundle.hourly?.ok).toBe(true);
    expect(bundle.airQuality).toBeUndefined();
  });

  it('remembers a 404 (API older than web) and stops calling the bundle endpoint', async () => {
    mockGet.mockRejectedValue(ApiError.fromHttpStatus(404, 'İstenen API rotası bulunamadı.'));

    await expect(weatherService.getForecastBundle(38.42, 27.14)).rejects.toMatchObject({
      name: 'BundleUnavailableError',
      reason: 'unsupported',
    });
    await expect(weatherService.getForecastBundle(38.42, 27.14)).rejects.toBeInstanceOf(
      BundleUnavailableError
    );
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('asks the caller to fall back when the bundle fails or is not a bundle envelope', async () => {
    mockGet.mockRejectedValueOnce(ApiError.fromHttpStatus(500));
    await expect(weatherService.getForecastBundle(38.42, 27.14)).rejects.toMatchObject({
      reason: 'failed',
    });

    mockGet.mockResolvedValueOnce('<!doctype html>');
    await expect(weatherService.getForecastBundle(38.42, 27.14)).rejects.toMatchObject({
      reason: 'failed',
    });

    mockGet.mockResolvedValueOnce({ cityName: 'İzmir' });
    await expect(weatherService.getForecastBundle(38.42, 27.14)).rejects.toMatchObject({
      reason: 'failed',
    });
    // 500 is not remembered: the next city tries the bundle again.
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it('does not fall back on rate limits or caller cancellation', async () => {
    mockGet.mockRejectedValueOnce(ApiError.fromHttpStatus(429));
    await expect(weatherService.getForecastBundle(38.42, 27.14)).rejects.toMatchObject({
      code: ErrorCode.RATE_LIMIT,
    });

    const abort = new Error('aborted');
    abort.name = 'AbortError';
    mockGet.mockRejectedValueOnce(abort);
    await expect(weatherService.getForecastBundle(38.42, 27.14)).rejects.toBe(abort);
  });
});

describe('weatherService.getProvinceTemperatures', () => {
  beforeEach(() => {
    mockGet.mockReset();
    resetEndpointSupportForTests();
  });

  it('returns valid, recent observations keyed by plate', async () => {
    const recent = new Date(Date.now() - 20 * 60_000).toISOString();
    mockGet.mockResolvedValue({
      provinces: [
        {
          plate: 34,
          name: 'İstanbul',
          lat: 41.01,
          lon: 28.97,
          temperature: 18.4,
          weatherCode: 3,
          icon: '04d',
          description: 'kapalı',
          observedAt: recent,
        },
        {
          plate: 6,
          name: 'Ankara',
          lat: 39.93,
          lon: 32.86,
          temperature: 400,
          weatherCode: 0,
          icon: '01d',
          description: 'açık',
          observedAt: recent,
        },
        {
          plate: 35,
          name: 'İzmir',
          lat: 38.42,
          lon: 27.14,
          temperature: 22,
          weatherCode: 0,
          icon: '01d',
          description: 'açık',
          observedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      meta: {
        provider: 'Open-Meteo',
        attribution: 'Open-Meteo · CC BY 4.0',
        fetchedAt: nowIso(),
        units: 'metric',
        total: 81,
      },
    });

    const result = await weatherService.getProvinceTemperatures('tr');

    expect(mockGet).toHaveBeenCalledWith('/weather/provinces', { lang: 'tr' });
    expect(result?.byPlate.size).toBe(1);
    expect(result?.byPlate.get(34)).toMatchObject({ temperature: 18.4, icon: '04d' });
    expect(result?.attribution).toBe('Open-Meteo · CC BY 4.0');
  });

  it('returns null when the endpoint is missing and remembers it', async () => {
    mockGet.mockRejectedValue(ApiError.fromHttpStatus(404));

    await expect(weatherService.getProvinceTemperatures()).resolves.toBeNull();
    await expect(weatherService.getProvinceTemperatures()).resolves.toBeNull();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
