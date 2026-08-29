/**
 * useWeather Hook Tests
 */

import { vi, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWeather } from '../../hooks/useWeather';
import { weatherService } from '../../api/weatherService';

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
            fetchedAt: '2026-07-14T12:00:00.000Z',
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
    expect(result.current.recentSearches[0].city).toBe('Istanbul');
  });
});
