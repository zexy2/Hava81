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
};

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
});
