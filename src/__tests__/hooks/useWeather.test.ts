/**
 * useWeather Hook Tests
 */

import { vi, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWeather } from '../../hooks/useWeather';
import { weatherService } from '../../api/weatherService';
import { ApiError } from '../../api/errors/ApiError';
import { ErrorCode } from '../../types';

// Mock the API
vi.mock('../../api/weatherService', () => ({
  weatherService: {
    getCurrentWeather: vi.fn().mockResolvedValue({
      cityName: 'İzmir',
      country: 'TR',
      temperature: 22,
      feelsLike: 21,
      humidity: 65,
      pressure: 1015,
      visibility: 10000,
      windSpeed: 3.5,
      windDirection: 180,
      description: 'açık hava',
      icon: '01d',
      sunrise: new Date(),
      sunset: new Date(),
      timestamp: new Date(),
      coordinates: { lat: 38.42, lon: 27.14 },
    }),
    getCurrentLocationWeather: vi.fn().mockResolvedValue({
      cityName: 'Ankara',
      country: 'TR',
      temperature: 18,
      feelsLike: 17,
      humidity: 55,
      pressure: 1020,
      visibility: 10000,
      windSpeed: 2.5,
      windDirection: 90,
      description: 'parçalı bulutlu',
      icon: '02d',
      sunrise: new Date(),
      sunset: new Date(),
      timestamp: new Date(),
      coordinates: { lat: 39.93, lon: 32.86 },
    }),
  },
}));

describe('useWeather', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (weatherService.getCurrentWeather as Mock).mockResolvedValue({
      cityName: 'İzmir',
      country: 'TR',
      temperature: 22,
      coordinates: { lat: 38.42, lon: 27.14 },
    });
    (weatherService.getCurrentLocationWeather as Mock).mockResolvedValue({
      cityName: 'Ankara',
      country: 'TR',
      temperature: 18,
      coordinates: { lat: 39.93, lon: 32.86 },
    });
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useWeather());

    expect(result.current.city).toBe('');
    expect(result.current.weather).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should initialize with initial city and finish the initial request', async () => {
    const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));

    expect(result.current.city).toBe('İstanbul');

    await waitFor(() => {
      expect(result.current.weather?.cityName).toBe('İzmir');
    });
  });

  it('refreshes provider-expired city evidence on resume even when the response was just received', async () => {
    const now = Date.now();
    (weatherService.getCurrentWeather as Mock).mockResolvedValueOnce({
      cityName: 'İzmir',
      country: 'TR',
      temperature: 22,
      coordinates: { lat: 38.42, lon: 27.14 },
      meta: {
        provider: 'OpenWeather',
        fetchedAt: new Date(now - 301_000),
        freshForSeconds: 300,
        timezoneOffsetSeconds: 10_800,
      },
    });

    const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));
    await waitFor(() => expect(result.current.weather?.cityName).toBe('İzmir'));
    expect(result.current.isStale).toBe(true);
    expect(weatherService.getCurrentWeather).toHaveBeenCalledTimes(1);

    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(weatherService.getCurrentWeather).toHaveBeenCalledTimes(2));
  });

  it('refreshes stale city weather when a long-lived tab becomes visible again', async () => {
    const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));
    await waitFor(() => expect(result.current.weather?.cityName).toBe('İzmir'));
    expect(weatherService.getCurrentWeather).toHaveBeenCalledTimes(1);

    const now = result.current.lastUpdated?.getTime();
    expect(now).toBeDefined();
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue((now ?? 0) + 5 * 60 * 1000 + 1);
    try {
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      await waitFor(() => expect(weatherService.getCurrentWeather).toHaveBeenCalledTimes(2));
      expect(weatherService.getCurrentLocationWeather).not.toHaveBeenCalled();
    } finally {
      dateNow.mockRestore();
    }
  });

  it('keeps the last successful city weather when a same-city refresh fails and error is dismissed', async () => {
    const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));
    await waitFor(() => expect(result.current.weather?.cityName).toBe('İzmir'));

    (weatherService.getCurrentWeather as Mock).mockRejectedValueOnce(
      new ApiError('provider unavailable', ErrorCode.NETWORK_ERROR)
    );
    await act(async () => {
      await result.current.fetchWeather('İzmir');
    });

    expect(result.current.weather?.cityName).toBe('İzmir');
    expect(result.current.error?.code).toBe(ErrorCode.NETWORK_ERROR);

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
    expect(result.current.weather?.cityName).toBe('İzmir');
  });

  it('does not retain another city weather when a different-city request fails', async () => {
    const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));
    await waitFor(() => expect(result.current.weather?.cityName).toBe('İzmir'));

    (weatherService.getCurrentWeather as Mock).mockRejectedValueOnce(
      new ApiError('provider unavailable', ErrorCode.NETWORK_ERROR)
    );
    await act(async () => {
      await result.current.fetchWeather('Ankara');
    });

    expect(result.current.weather).toBeNull();
    expect(result.current.error?.code).toBe(ErrorCode.NETWORK_ERROR);
  });

  it('keeps stale weather visible and skips resume refresh while the browser is offline', async () => {
    const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));
    await waitFor(() => expect(result.current.weather?.cityName).toBe('İzmir'));
    expect(weatherService.getCurrentWeather).toHaveBeenCalledTimes(1);

    const now = result.current.lastUpdated?.getTime();
    expect(now).toBeDefined();
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue((now ?? 0) + 5 * 60 * 1000 + 1);
    const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      await Promise.resolve();
      expect(weatherService.getCurrentWeather).toHaveBeenCalledTimes(1);
      expect(result.current.weather?.cityName).toBe('İzmir');
      expect(result.current.error).toBeNull();
    } finally {
      onLine.mockRestore();
      dateNow.mockRestore();
    }
  });

  it('refreshes preserved stale weather when connectivity returns while the tab is visible', async () => {
    const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));
    await waitFor(() => expect(result.current.weather?.cityName).toBe('İzmir'));
    expect(weatherService.getCurrentWeather).toHaveBeenCalledTimes(1);

    const now = result.current.lastUpdated?.getTime();
    expect(now).toBeDefined();
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue((now ?? 0) + 5 * 60 * 1000 + 1);
    const onlineState = vi.spyOn(window.navigator, 'onLine', 'get');
    onlineState.mockReturnValue(false);
    try {
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      await Promise.resolve();
      expect(weatherService.getCurrentWeather).toHaveBeenCalledTimes(1);

      onlineState.mockReturnValue(true);
      act(() => window.dispatchEvent(new Event('online')));
      await waitFor(() => expect(weatherService.getCurrentWeather).toHaveBeenCalledTimes(2));
    } finally {
      onlineState.mockRestore();
      dateNow.mockRestore();
    }
  });

  it('preserves location mode when stale weather refreshes after returning to the tab', async () => {
    const { result } = renderHook(() => useWeather());
    await act(async () => {
      await result.current.fetchCurrentLocation();
    });
    await waitFor(() => expect(result.current.weather?.cityName).toBe('Ankara'));
    expect(weatherService.getCurrentLocationWeather).toHaveBeenCalledTimes(1);

    const now = result.current.lastUpdated?.getTime();
    expect(now).toBeDefined();
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue((now ?? 0) + 5 * 60 * 1000 + 1);
    try {
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      await waitFor(() =>
        expect(weatherService.getCurrentLocationWeather).toHaveBeenCalledTimes(2)
      );
      expect(weatherService.getCurrentWeather).not.toHaveBeenCalled();
    } finally {
      dateNow.mockRestore();
    }
  });

  it('preserves location as the refresh source across a language change', async () => {
    const initialProps: { language: 'tr' | 'en' } = { language: 'tr' };
    const { result, rerender } = renderHook(
      ({ language }: { language: 'tr' | 'en' }) => useWeather({ language }),
      { initialProps }
    );

    await act(async () => {
      await result.current.fetchCurrentLocation();
    });
    await waitFor(() => expect(result.current.weather?.cityName).toBe('Ankara'));
    expect(weatherService.getCurrentLocationWeather).toHaveBeenCalledTimes(1);

    (weatherService.getCurrentWeather as Mock).mockResolvedValueOnce({
      cityName: 'Ankara',
      country: 'TR',
      temperature: 18,
      coordinates: { lat: 39.93, lon: 32.86 },
    });
    rerender({ language: 'en' });
    await waitFor(() =>
      expect(weatherService.getCurrentWeather).toHaveBeenCalledWith({ city: 'Ankara', lang: 'en' })
    );
    // The provider call beginning is not the same as the localized refresh settling.
    // Wait until the refresh completes before advancing time and simulating a later resume.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(weatherService.getCurrentLocationWeather).toHaveBeenCalledTimes(1);

    const now = result.current.lastUpdated?.getTime();
    expect(now).toBeDefined();
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue((now ?? 0) + 5 * 60 * 1000 + 1);
    try {
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      await waitFor(() =>
        expect(weatherService.getCurrentLocationWeather).toHaveBeenCalledTimes(2)
      );
    } finally {
      dateNow.mockRestore();
    }
  });

  it('revives cached weather dates before restoring a fresh cache entry', async () => {
    localStorage.setItem(
      'weather_cache',
      JSON.stringify({
        data: {
          cityName: 'İstanbul',
          country: 'TR',
          temperature: 24,
          feelsLike: 24,
          tempMin: 20,
          tempMax: 27,
          humidity: 55,
          pressure: 1014,
          visibility: 10000,
          windSpeed: 3,
          windDirection: 180,
          description: 'açık hava',
          icon: '01d',
          sunrise: '2026-07-14T02:43:00.000Z',
          sunset: '2026-07-14T17:34:00.000Z',
          timestamp: '2026-07-14T12:00:00.000Z',
          coordinates: { lat: 41.01, lon: 28.97 },
          clouds: 0,
          meta: {
            provider: 'OpenWeather',
            fetchedAt: new Date().toISOString(),
            freshForSeconds: 300,
          },
        },
        timestamp: Date.now(),
        language: 'tr',
      })
    );

    const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));

    await waitFor(() => expect(result.current.weather?.cityName).toBe('İstanbul'));
    expect(result.current.weather?.sunrise).toBeInstanceOf(Date);
    expect(result.current.weather?.sunset).toBeInstanceOf(Date);
    expect(result.current.weather?.timestamp).toBeInstanceOf(Date);
    expect(weatherService.getCurrentWeather).not.toHaveBeenCalled();
  });

  it('rejects a newly persisted cache entry when the provider observation is already stale', async () => {
    const now = Date.now();
    localStorage.setItem(
      'weather_cache',
      JSON.stringify({
        data: {
          cityName: 'İstanbul',
          country: 'TR',
          temperature: 24,
          feelsLike: 24,
          tempMin: 20,
          tempMax: 27,
          humidity: 55,
          pressure: 1014,
          visibility: 10000,
          windSpeed: 3,
          windDirection: 180,
          description: 'stale cache',
          icon: '01d',
          sunrise: '2026-09-02T03:30:00.000Z',
          sunset: '2026-09-02T16:30:00.000Z',
          timestamp: new Date(now - 301_000).toISOString(),
          coordinates: { lat: 41.01, lon: 28.97 },
          clouds: 0,
          meta: {
            provider: 'OpenWeather',
            fetchedAt: new Date(now - 301_000).toISOString(),
            freshForSeconds: 300,
          },
        },
        timestamp: now,
        language: 'tr',
      })
    );

    const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));

    await waitFor(() =>
      expect(weatherService.getCurrentWeather).toHaveBeenCalledWith({ city: 'İstanbul', lang: 'tr' })
    );
    await waitFor(() => expect(result.current.weather?.cityName).toBe('İzmir'));
    expect(result.current.weather?.description).not.toBe('stale cache');
  });

  it('ignores malformed persisted weather cache instead of rendering untrusted weather values', async () => {
    localStorage.setItem(
      'weather_cache',
      JSON.stringify({
        data: {
          cityName: 'İstanbul',
          country: 'TR',
          temperature: '999',
          feelsLike: 24,
          tempMin: 20,
          tempMax: 27,
          humidity: 55,
          pressure: 1014,
          windSpeed: 3,
          windDirection: 180,
          description: 'cache injection',
          icon: '01d',
          sunrise: '2026-07-14T02:43:00.000Z',
          sunset: '2026-07-14T17:34:00.000Z',
          timestamp: '2026-07-14T12:00:00.000Z',
          coordinates: { lat: 41.01, lon: 28.97 },
          clouds: 0,
          meta: { provider: 'OpenWeather', fetchedAt: '2026-07-14T12:00:00.000Z' },
        },
        timestamp: Date.now(),
        language: 'tr',
      })
    );

    const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));

    await waitFor(() =>
      expect(weatherService.getCurrentWeather).toHaveBeenCalledWith({
        city: 'İstanbul',
        lang: 'tr',
      })
    );
    await waitFor(() => expect(result.current.weather?.cityName).toBe('İzmir'));
    expect(result.current.weather?.description).not.toBe('cache injection');
  });

  it.each([
    ['temperature', { temperature: 999 }],
    ['feels-like temperature', { feelsLike: -999 }],
    ['minimum temperature', { tempMin: -999 }],
    ['maximum temperature', { tempMax: 999 }],
    ['pressure', { pressure: 0 }],
  ])('rejects cached weather with impossible finite %s values', async (_label, invalidField) => {
    localStorage.setItem(
      'weather_cache',
      JSON.stringify({
        data: {
          cityName: 'İstanbul',
          country: 'TR',
          temperature: 24,
          feelsLike: 24,
          tempMin: 20,
          tempMax: 27,
          humidity: 55,
          pressure: 1014,
          visibility: 10000,
          windSpeed: 3,
          windDirection: 180,
          description: 'impossible finite cache',
          icon: '01d',
          sunrise: '2026-07-14T02:43:00.000Z',
          sunset: '2026-07-14T17:34:00.000Z',
          timestamp: '2026-07-14T12:00:00.000Z',
          coordinates: { lat: 41.01, lon: 28.97 },
          clouds: 0,
          meta: { provider: 'OpenWeather', fetchedAt: '2026-07-14T12:00:00.000Z' },
          ...invalidField,
        },
        timestamp: Date.now(),
        language: 'tr',
      })
    );

    const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));

    await waitFor(() => expect(weatherService.getCurrentWeather).toHaveBeenCalled());
    await waitFor(() => expect(result.current.weather?.cityName).toBe('İzmir'));
    expect(result.current.weather?.description).not.toBe('impossible finite cache');
  });

  it('rejects cached weather whose minimum temperature exceeds its maximum', async () => {
    localStorage.setItem(
      'weather_cache',
      JSON.stringify({
        data: {
          cityName: 'İstanbul',
          country: 'TR',
          temperature: 24,
          feelsLike: 24,
          tempMin: 30,
          tempMax: 20,
          humidity: 55,
          pressure: 1014,
          visibility: 10000,
          windSpeed: 3,
          windDirection: 180,
          description: 'reversed range cache',
          icon: '01d',
          sunrise: '2026-07-14T02:43:00.000Z',
          sunset: '2026-07-14T17:34:00.000Z',
          timestamp: '2026-07-14T12:00:00.000Z',
          coordinates: { lat: 41.01, lon: 28.97 },
          clouds: 0,
          meta: { provider: 'OpenWeather', fetchedAt: '2026-07-14T12:00:00.000Z' },
        },
        timestamp: Date.now(),
        language: 'tr',
      })
    );

    const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));

    await waitFor(() => expect(weatherService.getCurrentWeather).toHaveBeenCalled());
    await waitFor(() => expect(result.current.weather?.cityName).toBe('İzmir'));
    expect(result.current.weather?.description).not.toBe('reversed range cache');
  });

  it('rejects implausibly future-dated cache entries so they cannot stay fresh indefinitely', async () => {
    localStorage.setItem(
      'weather_cache',
      JSON.stringify({
        data: {
          cityName: 'İstanbul',
          country: 'TR',
          temperature: 24,
          feelsLike: 24,
          tempMin: 20,
          tempMax: 27,
          humidity: 55,
          pressure: 1014,
          windSpeed: 3,
          windDirection: 180,
          description: 'future cache',
          icon: '01d',
          sunrise: '2026-07-14T02:43:00.000Z',
          sunset: '2026-07-14T17:34:00.000Z',
          timestamp: '2026-07-14T12:00:00.000Z',
          coordinates: { lat: 41.01, lon: 28.97 },
          clouds: 0,
          meta: { provider: 'OpenWeather', fetchedAt: '2026-07-14T12:00:00.000Z' },
        },
        timestamp: Date.now() + 10 * 60 * 1000,
        language: 'tr',
      })
    );

    renderHook(() => useWeather({ initialCity: 'İstanbul' }));
    await waitFor(() => expect(weatherService.getCurrentWeather).toHaveBeenCalled());
  });

  it.each(['timestamp', 'fetchedAt'] as const)(
    'rejects cached weather with an implausibly future %s',
    async futureField => {
      const futureIso = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      localStorage.setItem(
        'weather_cache',
        JSON.stringify({
          data: {
            cityName: 'İstanbul',
            country: 'TR',
            temperature: 24,
            feelsLike: 24,
            tempMin: 20,
            tempMax: 27,
            humidity: 55,
            pressure: 1014,
            visibility: 10000,
            windSpeed: 3,
            windDirection: 180,
            description: 'future current metadata cache',
            icon: '01d',
            sunrise: '2026-07-14T02:43:00.000Z',
            sunset: '2026-07-14T17:34:00.000Z',
            timestamp: futureField === 'timestamp' ? futureIso : '2026-07-14T12:00:00.000Z',
            coordinates: { lat: 41.01, lon: 28.97 },
            clouds: 0,
            meta: {
              provider: 'OpenWeather',
              fetchedAt: futureField === 'fetchedAt' ? futureIso : '2026-07-14T12:00:00.000Z',
            },
          },
          timestamp: Date.now(),
          language: 'tr',
        })
      );

      const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));

      await waitFor(() => expect(weatherService.getCurrentWeather).toHaveBeenCalled());
      await waitFor(() => expect(result.current.weather?.cityName).toBe('İzmir'));
      expect(result.current.weather?.description).not.toBe('future current metadata cache');
    }
  );

  it.each([
    ['timezone offset', { timezoneOffsetSeconds: 99_999 }],
    ['forecast interval', { intervalHours: 0 }],
    ['freshness window', { freshForSeconds: 999_999 }],
    ['cache status', { cacheStatus: 'FOREVER' }],
  ])('ignores cached weather with invalid %s metadata', async (_label, invalidMeta) => {
    localStorage.setItem(
      'weather_cache',
      JSON.stringify({
        data: {
          cityName: 'İstanbul',
          country: 'TR',
          temperature: 24,
          feelsLike: 24,
          tempMin: 20,
          tempMax: 27,
          humidity: 55,
          pressure: 1014,
          windSpeed: 3,
          windDirection: 180,
          description: 'açık hava',
          icon: '01d',
          sunrise: '2026-07-14T02:43:00.000Z',
          sunset: '2026-07-14T17:34:00.000Z',
          timestamp: '2026-07-14T12:00:00.000Z',
          coordinates: { lat: 41.01, lon: 28.97 },
          clouds: 0,
          meta: {
            provider: 'OpenWeather',
            fetchedAt: '2026-07-14T12:00:00.000Z',
            ...invalidMeta,
          },
        },
        timestamp: Date.now(),
        language: 'tr',
      })
    );

    renderHook(() => useWeather({ initialCity: 'İstanbul' }));
    await waitFor(() => expect(weatherService.getCurrentWeather).toHaveBeenCalled());
  });

  it.each([
    ['humidity', { humidity: 140 }],
    ['cloud cover', { clouds: -1 }],
    ['visibility', { visibility: -1 }],
    ['wind speed', { windSpeed: -1 }],
    ['wind direction', { windDirection: 361 }],
    ['latitude', { coordinates: { lat: 91, lon: 28.97 } }],
    ['longitude', { coordinates: { lat: 41.01, lon: 181 } }],
  ])('ignores cached weather with invalid %s domain values', async (_label, invalidData) => {
    localStorage.setItem(
      'weather_cache',
      JSON.stringify({
        data: {
          cityName: 'İstanbul',
          country: 'TR',
          temperature: 24,
          feelsLike: 24,
          tempMin: 20,
          tempMax: 27,
          humidity: 55,
          pressure: 1014,
          visibility: 10000,
          windSpeed: 3,
          windDirection: 180,
          description: 'açık hava',
          icon: '01d',
          sunrise: '2026-07-14T02:43:00.000Z',
          sunset: '2026-07-14T17:34:00.000Z',
          timestamp: '2026-07-14T12:00:00.000Z',
          coordinates: { lat: 41.01, lon: 28.97 },
          clouds: 0,
          meta: { provider: 'OpenWeather', fetchedAt: '2026-07-14T12:00:00.000Z' },
          ...invalidData,
        },
        timestamp: Date.now(),
        language: 'tr',
      })
    );

    renderHook(() => useWeather({ initialCity: 'İstanbul' }));
    await waitFor(() => expect(weatherService.getCurrentWeather).toHaveBeenCalled());
  });

  it('ignores cached weather whose sunset precedes sunrise', async () => {
    localStorage.setItem(
      'weather_cache',
      JSON.stringify({
        data: {
          cityName: 'İstanbul',
          country: 'TR',
          temperature: 24,
          feelsLike: 24,
          tempMin: 20,
          tempMax: 27,
          humidity: 55,
          pressure: 1014,
          visibility: 10000,
          windSpeed: 3,
          windDirection: 180,
          description: 'reversed daylight cache',
          icon: '01d',
          sunrise: '2026-07-14T17:34:00.000Z',
          sunset: '2026-07-14T02:43:00.000Z',
          timestamp: '2026-07-14T12:00:00.000Z',
          coordinates: { lat: 41.01, lon: 28.97 },
          clouds: 0,
          meta: { provider: 'OpenWeather', fetchedAt: '2026-07-14T12:00:00.000Z' },
        },
        timestamp: Date.now(),
        language: 'tr',
      })
    );

    const { result } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));

    await waitFor(() => expect(weatherService.getCurrentWeather).toHaveBeenCalled());
    await waitFor(() => expect(result.current.weather?.cityName).toBe('İzmir'));
    expect(result.current.weather?.description).not.toBe('reversed daylight cache');
  });

  it('ignores cached weather with invalid provider metadata dates', async () => {
    localStorage.setItem(
      'weather_cache',
      JSON.stringify({
        data: {
          cityName: 'İstanbul',
          country: 'TR',
          temperature: 24,
          feelsLike: 24,
          tempMin: 20,
          tempMax: 27,
          humidity: 55,
          pressure: 1014,
          windSpeed: 3,
          windDirection: 180,
          description: 'açık hava',
          icon: '01d',
          sunrise: '2026-07-14T02:43:00.000Z',
          sunset: '2026-07-14T17:34:00.000Z',
          timestamp: '2026-07-14T12:00:00.000Z',
          coordinates: { lat: 41.01, lon: 28.97 },
          clouds: 0,
          meta: { provider: 'OpenWeather', fetchedAt: 'not-a-date' },
        },
        timestamp: Date.now(),
        language: 'tr',
      })
    );

    renderHook(() => useWeather({ initialCity: 'İstanbul' }));
    await waitFor(() => expect(weatherService.getCurrentWeather).toHaveBeenCalled());
  });

  it('keeps a location result authoritative when an older city request resolves late', async () => {
    let resolveCity:
      | ((value: {
          cityName: string;
          country: string;
          temperature: number;
          coordinates: { lat: number; lon: number };
        }) => void)
      | undefined;
    (weatherService.getCurrentWeather as Mock).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveCity = resolve;
        })
    );
    (weatherService.getCurrentLocationWeather as Mock).mockResolvedValueOnce({
      cityName: 'Ankara',
      country: 'TR',
      temperature: 18,
      coordinates: { lat: 39.93, lon: 32.86 },
    });

    const { result } = renderHook(() => useWeather());
    let cityRequest: Promise<unknown>;
    act(() => {
      cityRequest = result.current.fetchWeather('İzmir');
    });

    await act(async () => {
      await result.current.fetchCurrentLocation();
    });
    expect(result.current.weather?.cityName).toBe('Ankara');

    await act(async () => {
      resolveCity?.({
        cityName: 'İzmir',
        country: 'TR',
        temperature: 22,
        coordinates: { lat: 38.42, lon: 27.14 },
      });
      await cityRequest!;
    });

    expect(result.current.weather?.cityName).toBe('Ankara');
  });

  it('should update city when setCity is called', () => {
    const { result } = renderHook(() => useWeather());

    act(() => {
      result.current.setCity('Ankara');
    });

    expect(result.current.city).toBe('Ankara');
  });

  it('uses the translation catalog for Turkish network errors', async () => {
    (weatherService.getCurrentWeather as Mock).mockRejectedValueOnce(
      new ApiError('provider detail', ErrorCode.NETWORK_ERROR)
    );
    const { result } = renderHook(() => useWeather({ language: 'tr' }));

    await act(async () => {
      await result.current.fetchWeather('İstanbul');
    });

    expect(result.current.error?.message).toBe(
      'Bağlantı hatası. İnternet bağlantınızı kontrol edin.'
    );
    expect(result.current.error?.message).not.toContain('provider detail');
  });

  it.each([
    ['tr', 'Çok fazla istek gönderildi. Kısa bir süre sonra tekrar deneyin.'],
    ['en', 'Too many requests. Try again in a moment.'],
  ] as const)(
    'localizes %s rate-limit errors without exposing provider details',
    async (language, expected) => {
      (weatherService.getCurrentWeather as Mock).mockRejectedValueOnce(
        new ApiError('provider detail', ErrorCode.RATE_LIMIT, { retryable: true })
      );
      const { result } = renderHook(() => useWeather({ language }));

      await act(async () => {
        await result.current.fetchWeather('İstanbul');
      });

      expect(result.current.error?.message).toBe(expected);
      expect(result.current.error?.message).not.toContain('provider detail');
    }
  );

  it('uses the translation catalog for English not-found errors', async () => {
    (weatherService.getCurrentWeather as Mock).mockRejectedValueOnce(
      new ApiError('provider detail', ErrorCode.NOT_FOUND)
    );
    const { result } = renderHook(() => useWeather({ language: 'en' }));

    await act(async () => {
      await result.current.fetchWeather('Atlantis');
    });

    expect(result.current.error?.message).toBe('City not found');
    expect(result.current.error?.message).not.toContain('provider detail');
  });

  it.each([
    ['tr', ErrorCode.LOCATION_DENIED, 'Konum izni reddedildi'],
    ['tr', ErrorCode.LOCATION_UNAVAILABLE, 'Konum bilgisi alınamadı'],
    ['tr', ErrorCode.LOCATION_TIMEOUT, 'Konum isteği zaman aşımına uğradı'],
    ['en', ErrorCode.LOCATION_DENIED, 'Location permission denied'],
    ['en', ErrorCode.LOCATION_UNAVAILABLE, 'Location unavailable'],
    ['en', ErrorCode.LOCATION_TIMEOUT, 'Location request timed out'],
  ] as const)(
    'localizes %s location errors without exposing provider details',
    async (language, code, expectedMessage) => {
      (weatherService.getCurrentLocationWeather as Mock).mockRejectedValueOnce(
        new ApiError('provider detail', code, { retryable: false })
      );
      const { result } = renderHook(() => useWeather({ language }));

      await act(async () => {
        await result.current.fetchCurrentLocation();
      });

      expect(result.current.error?.message).toBe(expectedMessage);
      expect(result.current.error?.message).not.toContain('provider detail');
    }
  );

  it('should clear error when clearError is called', async () => {
    const { result } = renderHook(() => useWeather());

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should return recent searches array', () => {
    const { result } = renderHook(() => useWeather());

    expect(Array.isArray(result.current.recentSearches)).toBe(true);
  });

  it('sanitizes persisted recent searches before exposing or updating them', async () => {
    localStorage.setItem(
      'recent_weather_searches',
      JSON.stringify([
        { city: ' İstanbul ', timestamp: 10 },
        { city: 'Istanbul', timestamp: 9 },
        { city: '', timestamp: 8 },
        { city: 'Ankara', timestamp: 'bad' },
        { city: 'Atlantis', timestamp: 8 },
        { city: 'Bursa', timestamp: Date.now() + 120_000 },
        { city: 'Adana', timestamp: -1 },
        null,
        { city: 'İzmir', timestamp: 7, unexpected: 'ignored' },
      ])
    );

    const { result } = renderHook(() => useWeather());

    expect(result.current.recentSearches).toEqual([
      { city: 'İstanbul', timestamp: 10 },
      { city: 'İzmir', timestamp: 7 },
    ]);

    await act(async () => {
      await result.current.fetchWeather('İzmir');
    });

    expect(result.current.recentSearches[0].city).toBe('İzmir');
  });

  it('does not persist an unsupported provider city as a recent search', async () => {
    (weatherService.getCurrentWeather as Mock).mockResolvedValueOnce({
      cityName: 'Atlantis',
      country: 'TR',
      temperature: 20,
      coordinates: { lat: 0, lon: 0 },
    });

    const { result } = renderHook(() => useWeather());

    await act(async () => {
      await result.current.fetchWeather('İzmir');
    });

    expect(result.current.recentSearches).toEqual([]);
  });

  it('canonicalizes a persisted ASCII provider city label for display', () => {
    localStorage.setItem(
      'recent_weather_searches',
      JSON.stringify([{ city: 'Istanbul', timestamp: 9 }])
    );

    const { result } = renderHook(() => useWeather());

    expect(result.current.recentSearches).toEqual([{ city: 'İstanbul', timestamp: 9 }]);
  });

  it('falls back to an empty recent-search list when persisted JSON has the wrong shape', () => {
    localStorage.setItem('recent_weather_searches', JSON.stringify({ city: 'İstanbul' }));

    const { result } = renderHook(() => useWeather());

    expect(result.current.recentSearches).toEqual([]);
  });

  it('deduplicates recent searches across localized provider city labels', async () => {
    (weatherService.getCurrentWeather as Mock)
      .mockResolvedValueOnce({
        cityName: 'İstanbul',
        country: 'TR',
        temperature: 20,
        coordinates: { lat: 41.01, lon: 28.97 },
      })
      .mockResolvedValueOnce({
        cityName: 'Istanbul',
        country: 'TR',
        temperature: 20,
        coordinates: { lat: 41.01, lon: 28.97 },
      });

    const { result } = renderHook(() => useWeather());

    await act(async () => {
      await result.current.fetchWeather('İstanbul');
    });
    await act(async () => {
      await result.current.fetchWeather('Istanbul');
    });

    expect(result.current.recentSearches).toHaveLength(1);
    expect(result.current.recentSearches[0].city).toBe('İstanbul');
  });
});
