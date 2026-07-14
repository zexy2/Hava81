import { act, renderHook, waitFor } from '@testing-library/react';
import { weatherService } from '../../api/weatherService';
import { useForecast } from '../../hooks/useForecast';

jest.mock('../../api/weatherService', () => ({
  weatherService: {
    getForecast: jest.fn(),
    getAirQuality: jest.fn(),
  },
}));

describe('useForecast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (weatherService.getForecast as jest.Mock).mockResolvedValue({
      daily: [],
      hourly: [{ time: new Date('2026-07-14T12:00:00.000Z'), temp: 24, icon: '01d', pop: 0.1 }],
    });
    (weatherService.getAirQuality as jest.Mock).mockResolvedValue({
      aqi: 1,
      aqiLabel: 'Good',
      pm25: 5,
      pm10: 8,
      o3: 20,
    });
  });

  it('requests localized forecast data and exposes the completed result', async () => {
    const { result } = renderHook(() => useForecast('en'));

    await act(async () => {
      await result.current.fetch({ lat: 41.01, lon: 28.97 });
    });

    expect(weatherService.getForecast).toHaveBeenCalledWith(41.01, 28.97, 'en');
    expect(weatherService.getAirQuality).toHaveBeenCalledWith(41.01, 28.97, 'en');
    expect(result.current.hourly).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps only the latest city request when responses complete out of order', async () => {
    let resolveFirst: (value: {
      daily: never[];
      hourly: Array<{ time: Date; temp: number; icon: string; pop: number }>;
    }) => void;
    let resolveSecond: typeof resolveFirst;
    const first = new Promise<any>(resolve => {
      resolveFirst = resolve;
    });
    const second = new Promise<any>(resolve => {
      resolveSecond = resolve;
    });

    (weatherService.getForecast as jest.Mock)
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    const { result } = renderHook(() => useForecast('tr'));

    act(() => {
      void result.current.fetch({ lat: 41.01, lon: 28.97 });
      void result.current.fetch({ lat: 38.42, lon: 27.14 });
    });

    await act(async () => {
      resolveSecond!({
        daily: [],
        hourly: [{ time: new Date(), temp: 30, icon: '01d', pop: 0 }],
      });
    });
    await waitFor(() => expect(result.current.hourly[0]?.temp).toBe(30));

    await act(async () => {
      resolveFirst!({
        daily: [],
        hourly: [{ time: new Date(), temp: 10, icon: '01d', pop: 0 }],
      });
    });

    expect(result.current.hourly[0]?.temp).toBe(30);
  });
});
