/**
 * Weather Service Tests
 */

import { vi, type Mock } from 'vitest';
import { ApiError } from '../../api/errors/ApiError';
import { httpClient } from '../../api/httpClient';
import { weatherService } from '../../api/weatherService';
import { ErrorCode } from '../../types';

vi.mock('../../api/httpClient', () => ({
  httpClient: {
    get: vi.fn(),
  },
}));

const mockGet = httpClient.get as Mock;

const serializedWeather = {
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
  icon: '01d' as const,
  sunrise: '2026-07-14T02:45:00.000Z',
  sunset: '2026-07-14T17:35:00.000Z',
  timestamp: '2026-07-14T12:00:00.000Z',
  coordinates: { lat: 38.42, lon: 27.14 },
  clouds: 0,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: '2026-07-14T12:00:01.000Z',
    timezoneOffsetSeconds: 10800,
    cacheStatus: 'MISS' as const,
    freshForSeconds: 60,
  },
};

interface InvalidForecastFields {
  dailyPop?: number;
  hourlyPop?: number;
  dailyDate?: string;
  hourlyTime?: string;
  fetchedAt?: string;
}

const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

const setGeolocation = (geolocation: Geolocation | undefined) => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: geolocation,
  });
};

describe('weatherService - ApiError', () => {
  describe('ApiError class', () => {
    it('should create error with message and code', () => {
      const error = new ApiError('Test error', undefined, { retryable: false });

      expect(error.message).toBe('Test error');
      expect(error.retryable).toBe(false);
    });

    it('should create city not found error', () => {
      const error = ApiError.cityNotFound('TestCity');

      expect(error.message).toContain('TestCity');
      expect(error.retryable).toBe(false);
    });

    it('should create network error', () => {
      const error = ApiError.networkError();

      expect(error.message).toContain('bağlantı');
      expect(error.retryable).toBe(true);
    });

    it('should create error from HTTP status 404', () => {
      const error = ApiError.fromHttpStatus(404);

      expect(error.statusCode).toBe(404);
    });

    it('should create error from HTTP status 500', () => {
      const error = ApiError.fromHttpStatus(500);

      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
    });

    it('should convert to JSON', () => {
      const error = new ApiError('Test', undefined, { retryable: true });
      const json = error.toJSON();

      expect(json.message).toBe('Test');
      expect(json.retryable).toBe(true);
      expect(json.timestamp).toBeDefined();
    });

    it('derives retryability from error codes and HTTP statuses', () => {
      expect(new ApiError('Network', ErrorCode.NETWORK_ERROR).retryable).toBe(true);
      expect(new ApiError('Timeout', ErrorCode.UNKNOWN, { statusCode: 408 }).retryable).toBe(true);
      expect(new ApiError('Unknown', ErrorCode.UNKNOWN).retryable).toBe(false);
    });

    it('handles unmapped retryable and non-retryable HTTP statuses', () => {
      const gatewayError = ApiError.fromHttpStatus(502);
      const teapotError = ApiError.fromHttpStatus(418);

      expect(gatewayError).toMatchObject({
        code: ErrorCode.UNKNOWN,
        statusCode: 502,
        retryable: true,
      });
      expect(teapotError).toMatchObject({
        code: ErrorCode.UNKNOWN,
        statusCode: 418,
        retryable: false,
        message: 'Beklenmeyen bir hata oluştu',
      });
    });

    it('preserves an original network error as the cause', () => {
      const cause = new Error('socket closed');
      const error = ApiError.networkError(cause);

      expect((error as Error & { cause?: Error }).cause).toBe(cause);
    });
  });
});

describe('weatherService BFF client', () => {
  beforeEach(() => {
    mockGet.mockReset();
    Reflect.deleteProperty(window, '__HAVA81_BOOTSTRAP_WEATHER__');
  });

  afterEach(() => {
    if (originalGeolocation) {
      Object.defineProperty(navigator, 'geolocation', originalGeolocation);
    } else {
      Reflect.deleteProperty(navigator, 'geolocation');
    }
  });

  it('trims the city, sends defaults, and revives serialized weather dates', async () => {
    mockGet.mockResolvedValue(serializedWeather);

    const result = await weatherService.getCurrentWeather({ city: '  Izmir  ' });

    expect(mockGet).toHaveBeenCalledWith('/weather/current', {
      city: 'Izmir',
      units: 'metric',
      lang: 'tr',
    });
    expect(result.sunrise).toEqual(new Date(serializedWeather.sunrise));
    expect(result.sunset).toEqual(new Date(serializedWeather.sunset));
    expect(result.timestamp).toEqual(new Date(serializedWeather.timestamp));
  });

  it.each([
    ['sunrise', { sunrise: 'invalid' }],
    ['sunset', { sunset: 'invalid' }],
    ['observation timestamp', { timestamp: 'invalid' }],
    ['metadata timestamp', { meta: { ...serializedWeather.meta, fetchedAt: 'invalid' } }],
  ])('rejects malformed current-weather %s dates from the BFF', async (_label, invalidField) => {
    mockGet.mockResolvedValue({ ...serializedWeather, ...invalidField });

    await expect(weatherService.getCurrentWeather({ city: 'Izmir' })).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });

  it.each([
    ['non-finite temperature', { temperature: Number.NaN }],
    ['humidity above 100%', { humidity: 101 }],
    ['non-positive pressure', { pressure: 0 }],
    ['negative visibility', { visibility: -1 }],
    ['negative wind speed', { windSpeed: -0.1 }],
    ['wind direction above 360°', { windDirection: 361 }],
    ['cloud cover above 100%', { clouds: 101 }],
    ['latitude outside the globe', { coordinates: { ...serializedWeather.coordinates, lat: 91 } }],
    ['longitude outside the globe', { coordinates: { ...serializedWeather.coordinates, lon: 181 } }],
    ['blank city name', { cityName: '   ' }],
    ['blank country', { country: '   ' }],
    ['blank provider', { meta: { ...serializedWeather.meta, provider: '   ' } }],
    ['timezone outside global offset bounds', { meta: { ...serializedWeather.meta, timezoneOffsetSeconds: 50_401 } }],
    ['unbounded freshness window', { meta: { ...serializedWeather.meta, freshForSeconds: 86_401 } }],
  ])('rejects impossible current-weather %s from the BFF', async (_label, invalidField) => {
    mockGet.mockResolvedValue({ ...serializedWeather, ...invalidField });

    await expect(weatherService.getCurrentWeather({ city: 'Izmir' })).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });

  it('trims trusted current-weather identity fields after validation', async () => {
    mockGet.mockResolvedValue({
      ...serializedWeather,
      cityName: '  Izmir  ',
      country: ' TR ',
    });

    const result = await weatherService.getCurrentWeather({ city: 'Izmir' });

    expect(result.cityName).toBe('Izmir');
    expect(result.country).toBe('TR');
  });

  it('consumes a matching early weather bootstrap without duplicating the BFF request', async () => {
    window.__HAVA81_BOOTSTRAP_WEATHER__ = {
      city: 'Izmir',
      lang: 'tr',
      units: 'metric',
      promise: Promise.resolve(serializedWeather),
    };

    const result = await weatherService.getCurrentWeather({ city: '  Izmir  ' });

    expect(mockGet).not.toHaveBeenCalled();
    expect(result.timestamp).toEqual(new Date(serializedWeather.timestamp));
    expect(window.__HAVA81_BOOTSTRAP_WEATHER__).toBeUndefined();
  });

  it('falls back to the BFF when the early bootstrap does not match request preferences', async () => {
    window.__HAVA81_BOOTSTRAP_WEATHER__ = {
      city: 'Izmir',
      lang: 'tr',
      units: 'metric',
      promise: Promise.resolve(serializedWeather),
    };
    mockGet.mockResolvedValue(serializedWeather);

    await weatherService.getCurrentWeather({ city: 'Izmir', lang: 'en' });

    expect(mockGet).toHaveBeenCalledWith('/weather/current', {
      city: 'Izmir',
      units: 'metric',
      lang: 'en',
    });
  });

  it('forwards explicit unit and language preferences', async () => {
    mockGet.mockResolvedValue(serializedWeather);

    await weatherService.getCurrentWeather({
      city: 'Ankara',
      units: 'imperial',
      lang: 'en',
    });

    expect(mockGet).toHaveBeenCalledWith('/weather/current', {
      city: 'Ankara',
      units: 'imperial',
      lang: 'en',
    });
  });

  it('rejects an empty city before calling the BFF', async () => {
    await expect(weatherService.getCurrentWeather({ city: '   ' })).rejects.toMatchObject({
      message: 'Şehir adı gereklidir',
      retryable: false,
    });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('maps a BFF 404 to a city-specific domain error', async () => {
    mockGet.mockRejectedValue(ApiError.fromHttpStatus(404, 'Location not found'));

    await expect(weatherService.getCurrentWeather({ city: 'Missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      details: { searchedCity: 'Missing' },
      retryable: false,
    });
  });

  it('preserves non-404 client errors', async () => {
    const clientError = ApiError.fromHttpStatus(500, 'Provider unavailable');
    mockGet.mockRejectedValue(clientError);

    await expect(weatherService.getCurrentWeather({ city: 'Izmir' })).rejects.toBe(clientError);
  });

  it('fetches coordinates and revives weather dates', async () => {
    mockGet.mockResolvedValue(serializedWeather);

    const result = await weatherService.getWeatherByCoords(38.42, 27.14);

    expect(mockGet).toHaveBeenCalledWith('/weather/current', {
      lat: 38.42,
      lon: 27.14,
      units: 'metric',
      lang: 'tr',
    });
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('uses browser coordinates with the expected geolocation options', async () => {
    mockGet.mockResolvedValue(serializedWeather);
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 41.01, longitude: 28.97 },
      } as GeolocationPosition);
    });
    setGeolocation({ getCurrentPosition } as unknown as Geolocation);

    const result = await weatherService.getCurrentLocationWeather();

    expect(result.cityName).toBe('Izmir');
    expect(mockGet).toHaveBeenCalledWith(
      '/weather/current',
      expect.objectContaining({
        lat: 41.01,
        lon: 28.97,
      })
    );
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    });
  });

  it('rejects when browser geolocation is unavailable', async () => {
    setGeolocation(undefined);

    await expect(weatherService.getCurrentLocationWeather()).rejects.toMatchObject({
      message: 'Konum servisi desteklenmiyor',
      retryable: false,
    });
  });

  it.each([
    [1, 'Konum izni reddedildi'],
    [99, 'Konum hatası'],
  ])('maps geolocation error code %s', async (code, message) => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, failure: PositionErrorCallback) => {
        failure({ code } as GeolocationPositionError);
      }
    );
    setGeolocation({ getCurrentPosition } as unknown as Geolocation);

    await expect(weatherService.getCurrentLocationWeather()).rejects.toMatchObject({
      message,
      retryable: false,
    });
  });

  it('revives forecast dates returned by the BFF', async () => {
    mockGet.mockResolvedValue({
      daily: [
        {
          date: '2026-07-14',
          tempMin: 18,
          tempMax: 27,
          icon: '01d',
          description: 'clear',
          pop: 5,
        },
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
        fetchedAt: '2026-07-14T12:00:01.000Z',
        timezoneOffsetSeconds: 10800,
        intervalHours: 3,
        cacheStatus: 'MISS',
        freshForSeconds: 300,
      },
    });

    const result = await weatherService.getForecast(38.42, 27.14);

    expect(mockGet).toHaveBeenCalledWith('/weather/forecast', {
      lat: 38.42,
      lon: 27.14,
      units: 'metric',
      lang: 'tr',
    });
    expect(result.daily[0].date).toBeInstanceOf(Date);
    expect(result.hourly[0].time).toBeInstanceOf(Date);
    expect(result.daily[0].pop).toBe(0.05);
    expect(result.hourly[0].pop).toBe(0.05);
  });

  it.each([
    ['daily precipitation', { dailyPop: 140 }],
    ['hourly precipitation', { hourlyPop: -1 }],
    ['daily date', { dailyDate: 'not-a-date' }],
    ['hourly time', { hourlyTime: 'not-a-date' }],
    ['metadata timestamp', { fetchedAt: 'not-a-date' }],
  ])('rejects malformed BFF forecast %s instead of clamping or reviving it', async (_label, fixture) => {
    const invalid = fixture as InvalidForecastFields;
    mockGet.mockResolvedValue({
      daily: [
        {
          date: invalid.dailyDate ?? '2026-07-14',
          tempMin: 18,
          tempMax: 27,
          icon: '01d',
          description: 'clear',
          pop: invalid.dailyPop ?? 5,
        },
      ],
      hourly: [
        {
          time: invalid.hourlyTime ?? '2026-07-14T12:00:00.000Z',
          temp: 24,
          icon: '01d',
          pop: invalid.hourlyPop ?? 5,
          description: 'clear',
          windSpeed: 3.2,
        },
      ],
      meta: {
        provider: 'OpenWeather',
        fetchedAt: invalid.fetchedAt ?? '2026-07-14T12:00:01.000Z',
        timezoneOffsetSeconds: 10800,
        intervalHours: 3,
      },
    });

    await expect(weatherService.getForecast(38.42, 27.14)).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });

  it.each([
    ['non-finite daily minimum', { daily: { tempMin: Number.NaN } }],
    ['blank daily description', { daily: { description: '   ' } }],
    ['negative hourly wind speed', { hourly: { windSpeed: -1 } }],
    ['humidity above 100%', { hourly: { humidity: 101 } }],
    ['invalid forecast timezone offset', { meta: { timezoneOffsetSeconds: 50_401 } }],
    ['non-positive forecast interval', { meta: { intervalHours: 0 } }],
  ])('rejects impossible forecast domain value: %s', async (_label, invalid) => {
    mockGet.mockResolvedValue({
      daily: [
        {
          date: '2026-07-14',
          tempMin: 18,
          tempMax: 27,
          icon: '01d',
          description: 'clear',
          pop: 5,
          ...('daily' in invalid ? invalid.daily : {}),
        },
      ],
      hourly: [
        {
          time: '2026-07-14T12:00:00.000Z',
          temp: 24,
          icon: '01d',
          pop: 5,
          description: 'clear',
          windSpeed: 3.2,
          ...('hourly' in invalid ? invalid.hourly : {}),
        },
      ],
      meta: {
        provider: 'OpenWeather',
        fetchedAt: '2026-07-14T12:00:01.000Z',
        timezoneOffsetSeconds: 10800,
        intervalHours: 3,
        ...('meta' in invalid ? invalid.meta : {}),
      },
    });

    await expect(weatherService.getForecast(38.42, 27.14)).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });

  it('revives the one-hour forecast and calendar-day extrema returned by the BFF', async () => {
    mockGet.mockResolvedValue({
      daily: [
        {
          date: '2026-08-29',
          tempMin: 20,
          tempMax: 24.6,
          icon: '04d',
          description: 'kapalı',
          pop: 23,
        },
      ],
      hourly: [
        {
          time: '2026-08-28T18:00:00.000Z',
          temp: 24,
          icon: '01d',
          description: 'açık',
          pop: 35,
          windSpeed: 3.2,
          apparentTemperature: 25.1,
          humidity: 58,
          precipitationMm: 0.4,
          windGust: 7.2,
          uvIndex: 5.7,
          visibility: 22000,
          weatherCode: 1,
        },
      ],
      meta: {
        provider: 'Open-Meteo',
        attribution: 'Open-Meteo · CC BY 4.0',
        sourceUrl: 'https://open-meteo.com/',
        fetchedAt: '2026-08-28T17:00:00.000Z',
        timezoneOffsetSeconds: 10800,
        intervalHours: 1,
      },
    });

    const result = await weatherService.getHourlyForecast(41.01, 28.97, 'tr');

    expect(mockGet).toHaveBeenCalledWith('/weather/hourly', { lat: 41.01, lon: 28.97, lang: 'tr' });
    expect(result.daily?.[0].date).toBeInstanceOf(Date);
    expect(result.daily?.[0]).toMatchObject({ tempMin: 20, tempMax: 24.6, pop: 0.23 });
    expect(result.hourly[0].time).toBeInstanceOf(Date);
    expect(result.hourly[0].pop).toBe(0.35);
    expect(result.hourly[0]).toMatchObject({
      apparentTemperature: 25.1,
      humidity: 58,
      precipitationMm: 0.4,
      windGust: 7.2,
      uvIndex: 5.7,
      visibility: 22000,
      weatherCode: 1,
    });
    expect(result.meta.intervalHours).toBe(1);
    expect(result.meta.attribution).toBe('Open-Meteo · CC BY 4.0');
    expect(result.meta.sourceUrl).toBe('https://open-meteo.com/');
  });

  it.each([
    ['daily precipitation', { dailyPop: 140 }],
    ['hourly precipitation', { hourlyPop: -1 }],
    ['daily date', { dailyDate: 'invalid' }],
    ['hourly time', { hourlyTime: 'invalid' }],
    ['metadata timestamp', { fetchedAt: 'invalid' }],
  ])('rejects malformed one-hour BFF %s instead of fabricating a usable value', async (_label, fixture) => {
    const invalid = fixture as InvalidForecastFields;
    mockGet.mockResolvedValue({
      daily: [
        {
          date: invalid.dailyDate ?? '2026-08-29',
          tempMin: 20,
          tempMax: 24.6,
          icon: '04d',
          description: 'kapalı',
          pop: invalid.dailyPop ?? 23,
        },
      ],
      hourly: [
        {
          time: invalid.hourlyTime ?? '2026-08-28T18:00:00.000Z',
          temp: 24,
          icon: '01d',
          description: 'açık',
          pop: invalid.hourlyPop ?? 35,
          windSpeed: 3.2,
        },
      ],
      meta: {
        provider: 'Open-Meteo',
        fetchedAt: invalid.fetchedAt ?? '2026-08-28T17:00:00.000Z',
        timezoneOffsetSeconds: 10800,
        intervalHours: 1,
      },
    });

    await expect(weatherService.getHourlyForecast(41.01, 28.97, 'tr')).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });

  it.each([
    ['negative precipitation', { precipitationMm: -0.1 }],
    ['negative wind gust', { windGust: -1 }],
    ['negative UV index', { uvIndex: -0.1 }],
    ['negative visibility', { visibility: -1 }],
    ['weather code above WMO range', { weatherCode: 100 }],
  ])('rejects impossible one-hour forecast domain value: %s', async (_label, hourlyOverride) => {
    mockGet.mockResolvedValue({
      daily: [],
      hourly: [
        {
          time: '2026-08-28T18:00:00.000Z',
          temp: 24,
          icon: '01d',
          description: 'açık',
          pop: 35,
          windSpeed: 3.2,
          ...hourlyOverride,
        },
      ],
      meta: {
        provider: 'Open-Meteo',
        fetchedAt: '2026-08-28T17:00:00.000Z',
        timezoneOffsetSeconds: 10800,
        intervalHours: 1,
      },
    });

    await expect(weatherService.getHourlyForecast(41.01, 28.97, 'tr')).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });

  it('validates modeled context timestamps and physical domains at the browser boundary', async () => {
    const context = {
      provider: 'Open-Meteo',
      fetchedAt: '2026-08-29T17:00:00.000Z',
      attribution: 'Open-Meteo · CC BY 4.0',
      uvIndexMax: 6,
      dustMax: 12,
      grassPollenMax: 3,
      units: { dust: 'μg/m³', waveHeight: 'm', waveDirection: '°', wavePeriod: 's' },
      marine: {
        observedAt: '2026-08-29T17:00:00.000Z',
        waveHeight: 0.8,
        waveDirection: 210,
        wavePeriod: 5.5,
        seaSurfaceTemperature: 24,
      },
      freshForSeconds: 900,
    };
    mockGet.mockResolvedValue(context);

    await expect(weatherService.getContextSignals(41.01, 28.97, true)).resolves.toMatchObject({
      ...context,
      fetchedAt: new Date(context.fetchedAt),
    });
  });

  it.each([
    ['invalid fetchedAt', { fetchedAt: 'invalid' }],
    ['negative UV', { uvIndexMax: -1 }],
    ['negative dust', { dustMax: -1 }],
    ['invalid marine observation time', { marine: { observedAt: 'invalid', waveHeight: 1 } }],
    ['negative wave height', { marine: { observedAt: '2026-08-29T17:00:00.000Z', waveHeight: -0.1 } }],
    ['wave direction above 360°', { marine: { observedAt: '2026-08-29T17:00:00.000Z', waveDirection: 361 } }],
    ['non-positive wave period', { marine: { observedAt: '2026-08-29T17:00:00.000Z', wavePeriod: 0 } }],
  ])('rejects impossible modeled context %s from the BFF', async (_label, invalidField) => {
    mockGet.mockResolvedValue({
      provider: 'Open-Meteo',
      fetchedAt: '2026-08-29T17:00:00.000Z',
      attribution: 'Open-Meteo · CC BY 4.0',
      units: {},
      ...invalidField,
    });

    await expect(weatherService.getContextSignals(41.01, 28.97, true)).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });

  it('returns a validated route-weather corridor from the BFF', async () => {
    const route = {
      kind: 'corridor-estimate' as const,
      estimatedDistanceKm: 450,
      estimatedDurationMinutes: 360,
      requestedDeparture: '2026-08-29T18:00:00.000Z',
      score: 82,
      segments: [
        {
          fraction: 0,
          lat: 41.01,
          lon: 28.97,
          eta: '2026-08-29T18:00:00.000Z',
          temperature: 24,
          precipitationProbability: 20,
          windSpeed: 3.5,
          description: 'açık',
          score: 88,
          risk: 'low' as const,
        },
      ],
      betterDeparture: {
        departure: '2026-08-29T21:00:00.000Z',
        score: 91,
        improvement: 9,
      },
      disclaimer: 'Yaklaşık hava koridoru.',
    };
    mockGet.mockResolvedValue(route);

    await expect(
      weatherService.getRouteWeather(
        { lat: 41.01, lon: 28.97 },
        { lat: 39.93, lon: 32.86 },
        new Date('2026-08-29T18:00:00.000Z')
      )
    ).resolves.toEqual(route);
  });

  it.each([
    ['invalid departure', { requestedDeparture: 'invalid' }],
    ['score above 100', { score: 101 }],
    ['empty segments', { segments: [] }],
    ['negative distance', { estimatedDistanceKm: -1 }],
    ['non-positive duration', { estimatedDurationMinutes: 0 }],
    ['segment fraction above one', { segment: { fraction: 1.1 } }],
    ['segment latitude outside globe', { segment: { lat: 91 } }],
    ['invalid segment ETA', { segment: { eta: 'invalid' } }],
    ['precipitation above 100%', { segment: { precipitationProbability: 101 } }],
    ['negative wind speed', { segment: { windSpeed: -1 } }],
    ['invalid risk enum', { segment: { risk: 'unsafe' } }],
    ['invalid better departure', { betterDeparture: { departure: 'invalid', score: 90, improvement: 8 } }],
    ['non-positive better-departure improvement', { betterDeparture: { departure: '2026-08-29T21:00:00.000Z', score: 90, improvement: 0 } }],
  ])('rejects impossible route-weather %s from the BFF', async (_label, invalidField) => {
    const segment = {
      fraction: 0,
      lat: 41.01,
      lon: 28.97,
      eta: '2026-08-29T18:00:00.000Z',
      temperature: 24,
      precipitationProbability: 20,
      windSpeed: 3.5,
      description: 'açık',
      score: 88,
      risk: 'low',
      ...('segment' in invalidField ? invalidField.segment : {}),
    };
    const route = {
      kind: 'corridor-estimate',
      estimatedDistanceKm: 450,
      estimatedDurationMinutes: 360,
      requestedDeparture: '2026-08-29T18:00:00.000Z',
      score: 82,
      segments: [segment],
      disclaimer: 'Yaklaşık hava koridoru.',
      ...Object.fromEntries(Object.entries(invalidField).filter(([key]) => key !== 'segment')),
    };
    mockGet.mockResolvedValue(route);

    await expect(
      weatherService.getRouteWeather(
        { lat: 41.01, lon: 28.97 },
        { lat: 39.93, lon: 32.86 },
        new Date('2026-08-29T18:00:00.000Z')
      )
    ).rejects.toMatchObject({ code: ErrorCode.API_ERROR, retryable: true });
  });

  it('returns normalized air quality from the BFF', async () => {
    const airQuality = {
      aqi: 1,
      aqiLabel: 'Good',
      pm25: 5,
      pm10: 8,
      o3: 20,
      meta: { provider: 'OpenWeather', fetchedAt: '2026-07-14T12:00:01.000Z' },
    };
    mockGet.mockResolvedValue(airQuality);

    await expect(weatherService.getAirQuality(38.42, 27.14)).resolves.toMatchObject({
      ...airQuality,
      meta: { provider: 'OpenWeather', fetchedAt: new Date('2026-07-14T12:00:01.000Z') },
    });
    expect(mockGet).toHaveBeenCalledWith('/weather/air-quality', {
      lat: 38.42,
      lon: 27.14,
      lang: 'tr',
    });
  });

  it.each([
    ['AQI below provider scale', { aqi: 0 }],
    ['AQI above provider scale', { aqi: 6 }],
    ['negative PM2.5', { pm25: -1 }],
    ['negative PM10', { pm10: -1 }],
    ['negative ozone', { o3: -1 }],
    ['blank label', { aqiLabel: '   ' }],
    ['blank provider', { meta: { provider: '   ', fetchedAt: '2026-07-14T12:00:01.000Z' } }],
    ['invalid metadata timestamp', { meta: { provider: 'OpenWeather', fetchedAt: 'invalid' } }],
  ])('rejects impossible air-quality %s from the BFF', async (_label, invalidField) => {
    mockGet.mockResolvedValue({
      aqi: 1,
      aqiLabel: 'Good',
      pm25: 5,
      pm10: 8,
      o3: 20,
      meta: { provider: 'OpenWeather', fetchedAt: '2026-07-14T12:00:01.000Z' },
      ...invalidField,
    });

    await expect(weatherService.getAirQuality(38.42, 27.14)).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });
});
