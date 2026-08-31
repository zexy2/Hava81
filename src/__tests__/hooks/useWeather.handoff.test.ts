import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ApiError } from '../../api/errors/ApiError';
import { weatherService } from '../../api/weatherService';
import { useWeather } from '../../hooks/useWeather';
import { ErrorCode } from '../../types';

vi.mock('../../api/weatherService', () => ({
  weatherService: {
    getCurrentWeather: vi.fn(),
    getCurrentLocationWeather: vi.fn(),
  },
}));

const cityWeather = {
  cityName: 'İzmir',
  country: 'TR',
  temperature: 22,
  coordinates: { lat: 38.42, lon: 27.14 },
};

const locationWeather = {
  cityName: 'Ankara',
  country: 'TR',
  temperature: 18,
  coordinates: { lat: 39.93, lon: 32.86 },
};

describe('useWeather city/location handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('clears previously shown location weather while a city replacement is loading', async () => {
    (weatherService.getCurrentLocationWeather as Mock).mockResolvedValueOnce(locationWeather);
    let resolveCity: ((value: typeof cityWeather) => void) | undefined;
    (weatherService.getCurrentWeather as Mock).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveCity = resolve;
        })
    );

    const { result } = renderHook(() => useWeather());
    await act(async () => {
      await result.current.fetchCurrentLocation();
    });
    expect(result.current.weather?.cityName).toBe('Ankara');

    let cityRequest: Promise<unknown>;
    act(() => {
      cityRequest = result.current.fetchWeather('İzmir');
    });
    expect(result.current.weather).toBeNull();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveCity?.(cityWeather);
      await cityRequest!;
    });
    expect(result.current.weather?.cityName).toBe('İzmir');
  });

  it('keeps a city result authoritative when an older location request resolves late', async () => {
    let resolveLocation: ((value: typeof locationWeather) => void) | undefined;
    (weatherService.getCurrentLocationWeather as Mock).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveLocation = resolve;
        })
    );
    (weatherService.getCurrentWeather as Mock).mockResolvedValueOnce(cityWeather);

    const { result } = renderHook(() => useWeather());
    let locationRequest: Promise<unknown>;
    act(() => {
      locationRequest = result.current.fetchCurrentLocation();
    });

    await act(async () => {
      await result.current.fetchWeather('İzmir');
    });
    expect(result.current.weather?.cityName).toBe('İzmir');

    await act(async () => {
      resolveLocation?.(locationWeather);
      await locationRequest!;
    });
    expect(result.current.weather?.cityName).toBe('İzmir');
  });

  it('keeps the current city visible while a location handoff is pending or fails', async () => {
    (weatherService.getCurrentWeather as Mock).mockResolvedValueOnce(cityWeather);
    let rejectLocation: ((reason?: unknown) => void) | undefined;
    (weatherService.getCurrentLocationWeather as Mock).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectLocation = reject;
        })
    );

    const { result } = renderHook(() => useWeather());
    await act(async () => {
      await result.current.fetchWeather('İzmir');
    });
    expect(result.current.weather?.cityName).toBe('İzmir');

    let locationRequest: Promise<unknown>;
    act(() => {
      locationRequest = result.current.fetchCurrentLocation();
    });
    expect(result.current.weather?.cityName).toBe('İzmir');
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      rejectLocation?.(new Error('location unavailable'));
      await locationRequest!;
    });
    expect(result.current.weather?.cityName).toBe('İzmir');
    expect(result.current.error).not.toBeNull();
  });

  it('surfaces a new location failure instead of a stale city-request error', async () => {
    (weatherService.getCurrentWeather as Mock).mockRejectedValueOnce(
      ApiError.cityNotFound('İzmir')
    );
    (weatherService.getCurrentLocationWeather as Mock).mockRejectedValueOnce(
      new ApiError('location denied', ErrorCode.LOCATION_DENIED, { retryable: true })
    );

    const { result } = renderHook(() => useWeather());

    await act(async () => {
      await result.current.fetchWeather('İzmir');
    });
    expect(result.current.error?.code).toBe(ErrorCode.NOT_FOUND);

    let locationRequest: Promise<unknown>;
    act(() => {
      locationRequest = result.current.fetchCurrentLocation();
    });
    expect(result.current.error).toBeNull();

    await act(async () => {
      await locationRequest!;
    });
    expect(result.current.error?.code).toBe(ErrorCode.LOCATION_DENIED);
    expect(result.current.error?.message).toBe('Konum izni reddedildi');
  });
});
