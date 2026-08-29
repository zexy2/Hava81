import { vi, type Mock } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { weatherService } from '../../api/weatherService';
import { useForecast } from '../../hooks/useForecast';

vi.mock('../../api/weatherService', () => ({
  weatherService: {
    getForecast: vi.fn(),
    getHourlyForecast: vi.fn(),
    getAirQuality: vi.fn(),
    getContextSignals: vi.fn(),
  },
}));

describe('useForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (weatherService.getForecast as Mock).mockResolvedValue({
      daily: [],
      hourly: [{ time: new Date('2026-07-14T12:00:00.000Z'), temp: 24, icon: '01d', pop: 0.1 }],
      meta: {
        provider: 'OpenWeather',
        fetchedAt: new Date(),
        timezoneOffsetSeconds: 10800,
        intervalHours: 3,
      },
    });
    (weatherService.getHourlyForecast as Mock).mockResolvedValue({
      daily: [
        {
          date: new Date('2026-07-14T12:00:00.000Z'),
          tempMin: 18.4,
          tempMax: 27.6,
          icon: '02d',
          description: 'partly cloudy',
          pop: 0.1,
        },
      ],
      hourly: [{ time: new Date('2026-07-14T13:00:00.000Z'), temp: 25, icon: '01d', pop: 0.2 }],
      meta: {
        provider: 'Open-Meteo',
        attribution: 'Open-Meteo · CC BY 4.0',
        sourceUrl: 'https://open-meteo.com/',
        fetchedAt: new Date(),
        timezoneOffsetSeconds: 10800,
        intervalHours: 1,
      },
    });
    (weatherService.getContextSignals as Mock).mockResolvedValue(null);
    (weatherService.getAirQuality as Mock).mockResolvedValue({
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
    expect(weatherService.getHourlyForecast).toHaveBeenCalledWith(41.01, 28.97, 'en');
    expect(weatherService.getAirQuality).toHaveBeenCalledWith(41.01, 28.97, 'en');
    expect(weatherService.getContextSignals).toHaveBeenCalledWith(41.01, 28.97, false);
    expect(result.current.daily).toHaveLength(1);
    expect(result.current.daily[0]).toMatchObject({ tempMin: 18.4, tempMax: 27.6 });
    expect(result.current.hourly).toHaveLength(1);
    expect(result.current.hourly[0].temp).toBe(25);
    expect(result.current.displayHourly[0].temp).toBe(25);
    expect(result.current.displayMeta?.intervalHours).toBe(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('renders the three-hour baseline before a slow hourly upgrade completes', async () => {
    type HourlyResponse = Awaited<ReturnType<typeof weatherService.getHourlyForecast>>;
    let resolveHourly: (value: HourlyResponse) => void;
    const pendingHourly = new Promise<HourlyResponse>(resolve => {
      resolveHourly = resolve;
    });
    (weatherService.getHourlyForecast as Mock).mockReturnValueOnce(pendingHourly);

    const { result } = renderHook(() => useForecast('tr'));
    let fetchPromise: Promise<void>;
    act(() => {
      fetchPromise = result.current.fetch({ lat: 41.01, lon: 28.97 });
    });

    await waitFor(() => expect(result.current.displayMeta?.intervalHours).toBe(3));
    expect(result.current.displayHourly[0]?.temp).toBe(24);

    await act(async () => {
      resolveHourly!({
        hourly: [{ time: new Date('2026-07-14T13:00:00.000Z'), temp: 26, icon: '01d', pop: 0.2 }],
        meta: {
          provider: 'Open-Meteo',
          attribution: 'Open-Meteo · CC BY 4.0',
          sourceUrl: 'https://open-meteo.com/',
          fetchedAt: new Date(),
          timezoneOffsetSeconds: 10800,
          intervalHours: 1,
        },
      });
      await fetchPromise!;
    });

    expect(result.current.displayMeta?.intervalHours).toBe(1);
    expect(result.current.hourly[0]?.temp).toBe(26);
    expect(result.current.displayHourly[0]?.temp).toBe(26);
  });

  it('keeps up to 48 hourly decision points while the visible atlas stays at 24 hours', async () => {
    const richHourly = Array.from({ length: 30 }, (_, index) => ({
      time: new Date(Date.parse('2026-07-14T13:00:00.000Z') + index * 60 * 60_000),
      temp: 25,
      icon: '01d' as const,
      pop: 0.1,
      windSpeed: 3,
      apparentTemperature: 25,
      humidity: 55,
      precipitationMm: 0,
      windGust: 5,
      uvIndex: 2,
      visibility: 20000,
      weatherCode: 0,
    }));
    (weatherService.getHourlyForecast as Mock).mockResolvedValueOnce({
      hourly: richHourly,
      meta: {
        provider: 'Open-Meteo',
        fetchedAt: new Date(),
        timezoneOffsetSeconds: 10800,
        intervalHours: 1,
      },
    });

    const { result } = renderHook(() => useForecast('tr'));
    await act(async () => {
      await result.current.fetch({ lat: 41.01, lon: 28.97 });
    });

    expect(result.current.hourly).toHaveLength(30);
    expect(result.current.displayHourly).toHaveLength(24);
    expect(result.current.displayMeta?.intervalHours).toBe(1);
  });

  it('falls back to the existing three-hour display when the hourly source is unavailable', async () => {
    (weatherService.getHourlyForecast as Mock).mockRejectedValueOnce(new Error('hourly unavailable'));
    const { result } = renderHook(() => useForecast('tr'));

    await act(async () => {
      await result.current.fetch({ lat: 41.01, lon: 28.97 });
    });

    expect(result.current.displayHourly[0].temp).toBe(24);
    expect(result.current.displayMeta?.intervalHours).toBe(3);
    expect(result.current.error).toBeNull();
  });

  it('keeps only the latest city request when responses complete out of order', async () => {
    type ForecastResponse = Awaited<ReturnType<typeof weatherService.getForecast>>;
    let resolveFirst: (value: ForecastResponse) => void;
    let resolveSecond: typeof resolveFirst;
    const first = new Promise<ForecastResponse>(resolve => {
      resolveFirst = resolve;
    });
    const second = new Promise<ForecastResponse>(resolve => {
      resolveSecond = resolve;
    });

    (weatherService.getForecast as Mock).mockReturnValueOnce(first).mockReturnValueOnce(second);

    const { result } = renderHook(() => useForecast('tr'));

    act(() => {
      void result.current.fetch({ lat: 41.01, lon: 28.97 });
      void result.current.fetch({ lat: 38.42, lon: 27.14 });
    });

    await act(async () => {
      resolveSecond!({
        daily: [],
        hourly: [{ time: new Date(), temp: 30, icon: '01d', pop: 0 }],
        meta: {
          provider: 'OpenWeather',
          fetchedAt: new Date(),
          timezoneOffsetSeconds: 10800,
          intervalHours: 3,
        },
      });
    });
    await waitFor(() => expect(result.current.hourly[0]?.temp).toBe(25));

    await act(async () => {
      resolveFirst!({
        daily: [],
        hourly: [{ time: new Date(), temp: 10, icon: '01d', pop: 0 }],
        meta: {
          provider: 'OpenWeather',
          fetchedAt: new Date(),
          timezoneOffsetSeconds: 10800,
          intervalHours: 3,
        },
      });
    });

    expect(result.current.hourly[0]?.temp).toBe(25);
  });
});
