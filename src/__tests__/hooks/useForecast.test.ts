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
      meta: { provider: 'OpenWeather', fetchedAt: new Date(), freshForSeconds: 300 },
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
        hourly: [{ time: new Date('2026-07-14T13:00:00.000Z'), temp: 26, icon: '01d', pop: 0.2, windSpeed: 3 }],
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

  it('uses the dedicated hourly forecast when the baseline forecast request fails', async () => {
    (weatherService.getForecast as Mock).mockRejectedValueOnce(new Error('baseline unavailable'));
    const { result } = renderHook(() => useForecast('tr'));

    await act(async () => {
      await result.current.fetch({ lat: 41.01, lon: 28.97 });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.hourly[0]?.temp).toBe(25);
    expect(result.current.displayHourly[0]?.temp).toBe(25);
    expect(result.current.displayMeta?.intervalHours).toBe(1);
    expect(result.current.meta?.intervalHours).toBe(1);
    expect(result.current.daily).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('falls back to the existing three-hour display when the hourly source is unavailable', async () => {
    (weatherService.getHourlyForecast as Mock).mockRejectedValueOnce(
      new Error('hourly unavailable')
    );
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
        hourly: [{ time: new Date(), temp: 30, icon: '01d', pop: 0, windSpeed: 3 }],
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
        hourly: [{ time: new Date(), temp: 10, icon: '01d', pop: 0, windSpeed: 3 }],
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
  it('keeps successful optional context through a same-city refresh when only optional sources fail', async () => {
    const context = {
      provider: 'Open-Meteo',
      fetchedAt: new Date(),
      freshForSeconds: 300,
      attribution: 'Open-Meteo · CC BY 4.0',
      uvIndexMax: 5,
      units: {},
    };
    (weatherService.getContextSignals as Mock).mockResolvedValueOnce(context);
    (weatherService.getAirQuality as Mock).mockResolvedValueOnce({
      aqi: 1,
      aqiLabel: 'Good',
      pm25: 5,
      pm10: 8,
      o3: 20,
      meta: { provider: 'OpenWeather', fetchedAt: new Date(), freshForSeconds: 300 },
    });
    const { result } = renderHook(() => useForecast('tr'));
    const coords = { lat: 41.01, lon: 28.97 };

    await act(async () => {
      await result.current.fetch(coords);
    });
    expect(result.current.airQuality?.aqi).toBe(1);
    expect(result.current.contextSignals).toMatchObject({ provider: 'Open-Meteo', uvIndexMax: 5 });

    (weatherService.getAirQuality as Mock).mockRejectedValueOnce(new Error('aq unavailable'));
    (weatherService.getContextSignals as Mock).mockRejectedValueOnce(
      new Error('context unavailable')
    );
    await act(async () => {
      await result.current.fetch(coords);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.airQuality?.aqi).toBe(1);
    expect(result.current.contextSignals).toMatchObject({ provider: 'Open-Meteo', uvIndexMax: 5 });
  });

  it('drops stale optional evidence without waiting for another refresh', async () => {
    const staleAt = new Date(Date.now() - 10 * 60_000);
    (weatherService.getAirQuality as Mock).mockResolvedValueOnce({
      aqi: 2,
      aqiLabel: 'Fair',
      pm25: 9,
      pm10: 12,
      o3: 25,
      meta: { provider: 'OpenWeather', fetchedAt: staleAt, freshForSeconds: 300 },
    });
    (weatherService.getContextSignals as Mock).mockResolvedValueOnce({
      provider: 'Open-Meteo',
      fetchedAt: staleAt,
      attribution: 'Open-Meteo · CC BY 4.0',
      freshForSeconds: 300,
      units: {},
    });
    const { result } = renderHook(() => useForecast('tr'));

    await act(async () => {
      await result.current.fetch({ lat: 41.01, lon: 28.97 });
    });

    await waitFor(() => expect(result.current.airQuality).toBeNull());
    expect(result.current.contextSignals).toBeNull();
  });

  it('expires optional evidence when its freshness TTL passes in a long-lived tab', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-01T18:00:00Z'));
      const fetchedAt = new Date();
      (weatherService.getAirQuality as Mock).mockResolvedValueOnce({
        aqi: 1,
        aqiLabel: 'Good',
        pm25: 5,
        pm10: 8,
        o3: 20,
        meta: { provider: 'OpenWeather', fetchedAt, freshForSeconds: 30 },
      });
      (weatherService.getContextSignals as Mock).mockResolvedValueOnce({
        provider: 'Open-Meteo',
        fetchedAt,
        attribution: 'Open-Meteo · CC BY 4.0',
        freshForSeconds: 30,
        uvIndexMax: 5,
        units: {},
      });
      const { result } = renderHook(() => useForecast('tr'));

      await act(async () => {
        await result.current.fetch({ lat: 41.01, lon: 28.97 });
      });
      expect(result.current.airQuality?.aqi).toBe(1);
      expect(result.current.contextSignals?.uvIndexMax).toBe(5);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_200);
      });

      expect(result.current.airQuality).toBeNull();
      expect(result.current.contextSignals).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the last successful forecast when a same-city refresh fails', async () => {
    const { result } = renderHook(() => useForecast('tr'));
    const coords = { lat: 41.01, lon: 28.97 };

    await act(async () => {
      await result.current.fetch(coords);
    });
    expect(result.current.displayHourly[0]?.temp).toBe(25);

    (weatherService.getForecast as Mock).mockRejectedValueOnce(new Error('provider unavailable'));
    (weatherService.getHourlyForecast as Mock).mockRejectedValueOnce(
      new Error('hourly unavailable')
    );
    await act(async () => {
      await result.current.fetch(coords);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.displayHourly[0]?.temp).toBe(25);
    expect(result.current.displayMeta?.intervalHours).toBe(1);
  });

  it('does not retain another city forecast when a different-city refresh starts', async () => {
    type ForecastResponse = Awaited<ReturnType<typeof weatherService.getForecast>>;
    let rejectNext: (reason?: unknown) => void;
    const pending = new Promise<ForecastResponse>((_, reject) => {
      rejectNext = reject;
    });
    const { result } = renderHook(() => useForecast('tr'));

    await act(async () => {
      await result.current.fetch({ lat: 41.01, lon: 28.97 });
    });
    expect(result.current.displayHourly).not.toHaveLength(0);

    (weatherService.getForecast as Mock).mockReturnValueOnce(pending);
    act(() => {
      void result.current.fetch({ lat: 38.42, lon: 27.14 });
    });

    expect(result.current.displayHourly).toHaveLength(0);
    expect(result.current.displayMeta).toBeNull();

    await act(async () => {
      rejectNext!(new Error('provider unavailable'));
      await pending.catch(() => undefined);
    });
  });
});
