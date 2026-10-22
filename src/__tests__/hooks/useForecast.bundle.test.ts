/**
 * Faz 3.2: useForecast tek `/weather/bundle` isteği, eski API'ye geri düşüş,
 * istek iptali ve yalnız çekirdek veriye bağlı isLoading.
 */
import { vi, type Mock } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '../../api/errors/ApiError';
import { weatherService } from '../../api/weatherService';
import { BundleUnavailableError, type ForecastBundle } from '../../api/weatherBundle';
import { useForecast } from '../../hooks/useForecast';

vi.mock('../../api/weatherService', () => ({
  weatherService: {
    getForecast: vi.fn(),
    getHourlyForecast: vi.fn(),
    getAirQuality: vi.fn(),
    getContextSignals: vi.fn(),
    getForecastBundle: vi.fn(),
    hasBootstrapHourly: vi.fn(),
  },
}));

const service = weatherService as unknown as Record<string, Mock>;

const baseline = () => ({
  daily: [],
  hourly: [{ time: new Date('2026-07-14T12:00:00.000Z'), temp: 24, icon: '01d', pop: 0.1 }],
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 3,
  },
});
const hourly = () => ({
  daily: [
    {
      date: new Date('2026-07-14T12:00:00.000Z'),
      tempMin: 18,
      tempMax: 27,
      icon: '02d',
      description: 'partly cloudy',
      pop: 0.1,
    },
  ],
  hourly: [{ time: new Date('2026-07-14T13:00:00.000Z'), temp: 25, icon: '01d', pop: 0.2 }],
  meta: {
    provider: 'Open-Meteo',
    fetchedAt: new Date(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 1,
  },
});
const airQuality = () => ({
  aqi: 2,
  aqiLabel: 'Fair',
  pm25: 5,
  pm10: 8,
  o3: 20,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(), freshForSeconds: 300 },
});
const context = () => ({
  provider: 'Open-Meteo' as const,
  fetchedAt: new Date(),
  freshForSeconds: 300,
  attribution: 'Open-Meteo · CC BY 4.0',
  units: {},
  uvIndexMax: 6,
});

const fullBundle = (): ForecastBundle => ({
  forecast: { ok: true, value: baseline() as never },
  hourly: { ok: true, value: hourly() as never },
  airQuality: { ok: true, value: airQuality() as never },
  context: { ok: true, value: context() as never },
});

describe('useForecast with /weather/bundle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.hasBootstrapHourly.mockReturnValue(false);
    service.getForecast.mockResolvedValue(baseline());
    service.getHourlyForecast.mockResolvedValue(hourly());
    service.getAirQuality.mockResolvedValue(airQuality());
    service.getContextSignals.mockResolvedValue(context());
  });

  it('loads every part from one bundle request without the single endpoints', async () => {
    service.getForecastBundle.mockResolvedValue(fullBundle());
    const { result } = renderHook(() => useForecast('en'));

    await act(async () => {
      await result.current.fetch({ lat: 38.42, lon: 27.14 }, 'İzmir');
    });

    expect(service.getForecastBundle).toHaveBeenCalledTimes(1);
    expect(service.getForecastBundle).toHaveBeenCalledWith(38.42, 27.14, 'en', {
      marine: true,
      signal: expect.any(AbortSignal),
      parts: ['forecast', 'hourly', 'airQuality', 'context'],
    });
    for (const single of [
      'getForecast',
      'getHourlyForecast',
      'getAirQuality',
      'getContextSignals',
    ]) {
      expect(service[single]).not.toHaveBeenCalled();
    }
    expect(result.current.hourly[0]?.temp).toBe(25);
    expect(result.current.displayMeta?.intervalHours).toBe(1);
    expect(result.current.airQuality?.aqi).toBe(2);
    expect(result.current.contextSignals?.uvIndexMax).toBe(6);
    expect(result.current.isLoading).toBe(false);
  });

  it('exposes the five-day planHourly horizon without widening hourly (plan v3 P1.1)', async () => {
    const start = Date.parse('2026-07-14T13:00:00.000Z');
    const planHourly = Array.from({ length: 120 }, (_, index) => ({
      time: new Date(start + index * 3_600_000),
      temp: 25,
      icon: '01d',
      pop: 0.2,
    }));
    const bundle = fullBundle();
    bundle.hourly = {
      ok: true,
      value: { ...hourly(), hourly: planHourly.slice(0, 48), planHourly } as never,
    };
    service.getForecastBundle.mockResolvedValue(bundle);
    const { result } = renderHook(() => useForecast('tr'));

    await act(async () => {
      await result.current.fetch({ lat: 41.01, lon: 28.97 }, 'İstanbul');
    });

    expect(result.current.hourly).toHaveLength(48);
    expect(result.current.planHourly).toHaveLength(120);
    expect(result.current.displayHourly).toHaveLength(24);
  });

  it('falls back to hourly for planHourly when an older API sends no extended horizon', async () => {
    service.getForecastBundle.mockResolvedValue(fullBundle());
    const { result } = renderHook(() => useForecast('tr'));

    await act(async () => {
      await result.current.fetch({ lat: 41.01, lon: 28.97 }, 'İstanbul');
    });

    expect(result.current.planHourly).toEqual(result.current.hourly);
  });

  it('falls back to the single endpoints when the API has no bundle (web deployed first)', async () => {
    service.getForecastBundle.mockRejectedValue(new BundleUnavailableError('unsupported'));
    const { result } = renderHook(() => useForecast('tr'));

    await act(async () => {
      await result.current.fetch({ lat: 41.01, lon: 28.97 });
    });

    expect(service.getForecast).toHaveBeenCalledTimes(1);
    expect(service.getHourlyForecast).toHaveBeenCalledTimes(1);
    expect(service.getAirQuality).toHaveBeenCalledTimes(1);
    expect(service.getContextSignals).toHaveBeenCalledWith(41.01, 28.97, false, {
      signal: expect.any(AbortSignal),
    });
    expect(result.current.hourly[0]?.temp).toBe(25);
    expect(result.current.airQuality?.aqi).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('uses only the failed core part from the server and keeps the rest', async () => {
    service.getForecastBundle.mockResolvedValue({
      ...fullBundle(),
      hourly: { ok: false, error: ApiError.fromHttpStatus(502) },
      airQuality: { ok: false, error: ApiError.fromHttpStatus(502) },
    });
    const { result } = renderHook(() => useForecast('tr'));

    await act(async () => {
      await result.current.fetch({ lat: 41.01, lon: 28.97 });
    });

    expect(service.getHourlyForecast).not.toHaveBeenCalled();
    expect(result.current.displayMeta?.intervalHours).toBe(3);
    expect(result.current.airQuality).toBeNull();
    expect(result.current.contextSignals?.uvIndexMax).toBe(6);
  });

  it('surfaces a rate limit without multiplying requests through the fallback', async () => {
    service.getForecastBundle.mockRejectedValue(ApiError.fromHttpStatus(429));
    const { result } = renderHook(() => useForecast('tr'));

    await act(async () => {
      await result.current.fetch({ lat: 41.01, lon: 28.97 });
    });

    expect(service.getForecast).not.toHaveBeenCalled();
    expect(service.getHourlyForecast).not.toHaveBeenCalled();
    expect((result.current.error as ApiError | null)?.statusCode).toBe(429);
  });

  it('keeps the prefetched (bootstrap) hourly response out of the bundle', async () => {
    service.hasBootstrapHourly.mockReturnValue(true);
    const { hourly: _omit, ...rest } = fullBundle();
    void _omit;
    service.getForecastBundle.mockResolvedValue(rest);
    const { result } = renderHook(() => useForecast('tr'));

    await act(async () => {
      await result.current.fetch({ lat: 41.01, lon: 28.97 });
    });

    expect(service.getForecastBundle.mock.calls[0][3].parts).toEqual([
      'forecast',
      'airQuality',
      'context',
    ]);
    expect(service.getHourlyForecast).toHaveBeenCalledTimes(1);
    expect(result.current.displayMeta?.intervalHours).toBe(1);
  });

  it('aborts the previous city request when a new city starts and on unmount', async () => {
    const signals: AbortSignal[] = [];
    service.getForecastBundle.mockImplementation(
      (_lat: number, _lon: number, _lang: string, options: { signal: AbortSignal }) => {
        signals.push(options.signal);
        return new Promise(() => undefined);
      }
    );
    const { result, unmount } = renderHook(() => useForecast('tr'));

    act(() => {
      void result.current.fetch({ lat: 41.01, lon: 28.97 });
    });
    act(() => {
      void result.current.fetch({ lat: 39.93, lon: 32.86 });
    });

    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    unmount();
    expect(signals[1]?.aborted).toBe(true);
  });

  it('stops loading once core data arrives even if optional evidence is still pending', async () => {
    service.getForecastBundle.mockRejectedValue(new BundleUnavailableError('failed'));
    service.getAirQuality.mockReturnValue(new Promise(() => undefined));
    service.getContextSignals.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useForecast('tr'));

    act(() => {
      void result.current.fetch({ lat: 41.01, lon: 28.97 });
    });

    await waitFor(() => expect(result.current.hourly[0]?.temp).toBe(25));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.airQuality).toBeNull();
  });
});
