/**
 * useWeather Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useWeather } from '../../hooks/useWeather';

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
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useWeather());

    expect(result.current.city).toBe('');
    expect(result.current.weather).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should initialize with initial city', () => {
    const { result } = renderHook(() => 
      useWeather({ initialCity: 'İstanbul' })
    );

    expect(result.current.city).toBe('İstanbul');
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
