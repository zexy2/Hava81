/**
 * useWeather Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useWeather } from '../../hooks/useWeather';
import { weatherService } from '../../api/weatherService';

// Mock the API
jest.mock('../../api/weatherService', () => ({
  weatherService: {
    getCurrentWeather: jest.fn().mockResolvedValue({
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
    getCurrentLocationWeather: jest.fn().mockResolvedValue({
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
    jest.clearAllMocks();
    localStorage.clear();
    (weatherService.getCurrentWeather as jest.Mock).mockResolvedValue({
      cityName: 'İzmir',
      country: 'TR',
      temperature: 22,
      coordinates: { lat: 38.42, lon: 27.14 },
    });
    (weatherService.getCurrentLocationWeather as jest.Mock).mockResolvedValue({
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
});
