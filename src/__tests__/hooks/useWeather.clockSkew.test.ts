import { act, renderHook, waitFor } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import { weatherService } from '../../api/weatherService';
import { useWeather } from '../../hooks/useWeather';

vi.mock('../../api/weatherService', () => ({
  weatherService: {
    getCurrentWeather: vi.fn(),
    getCurrentLocationWeather: vi.fn(),
  },
}));

describe('useWeather clock skew recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (weatherService.getCurrentWeather as Mock).mockResolvedValue({
      cityName: 'İzmir',
      country: 'TR',
      temperature: 22,
      coordinates: { lat: 38.42, lon: 27.14 },
    });
  });

  it('refreshes visible weather when the device clock moves behind the last update beyond the skew allowance', async () => {
    const { result, rerender } = renderHook(() => useWeather({ initialCity: 'İstanbul' }));
    await waitFor(() => expect(result.current.weather?.cityName).toBe('İzmir'));
    expect(weatherService.getCurrentWeather).toHaveBeenCalledTimes(1);

    const lastUpdated = result.current.lastUpdated?.getTime();
    expect(lastUpdated).toBeDefined();
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue((lastUpdated ?? 0) - 60_001);

    try {
      rerender();
      expect(result.current.isStale).toBe(true);

      act(() => document.dispatchEvent(new Event('visibilitychange')));
      await waitFor(() => expect(weatherService.getCurrentWeather).toHaveBeenCalledTimes(2));
    } finally {
      dateNow.mockRestore();
    }
  });
});
