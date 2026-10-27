import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparePanel } from '../../components/hava81/ComparePanel';
import { DayOutlookPanel } from '../../components/hava81/DayOutlookPanel';
import { SettingsProvider } from '../../context';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';
import '../../i18n';

const api = vi.hoisted(() => ({
  getCurrentWeather: vi.fn(),
  getForecast: vi.fn(),
  getHourlyForecast: vi.fn(),
  getAirQuality: vi.fn(),
}));
vi.mock('../../api/weatherService', () => ({ weatherService: api }));

// Wednesday 15 July 2026, 08:00 in Türkiye (UTC+3). Saturday is 18 July.
const NOW = Date.parse('2026-07-15T05:00:00Z');
const HOUR = 3_600_000;
const SATURDAY = (localHour: number) => Date.parse('2026-07-18T00:00:00Z') + (localHour - 3) * HOUR;

const weatherFor = (cityName: string): NormalizedWeatherData =>
  ({
    cityName,
    country: 'TR',
    temperature: 24,
    feelsLike: 24,
    tempMin: 20,
    tempMax: 28,
    humidity: 50,
    pressure: 1012,
    visibility: 10000,
    windSpeed: 3,
    windDirection: 180,
    description: 'açık',
    icon: '01d',
    sunrise: new Date(NOW),
    sunset: new Date(NOW + 12 * HOUR),
    timestamp: new Date(NOW),
    coordinates: cityName === 'İstanbul' ? { lat: 41, lon: 29 } : { lat: 38, lon: 27 },
    clouds: 0,
    meta: { provider: 'OpenWeather', fetchedAt: new Date(NOW), timezoneOffsetSeconds: 10800 },
  }) as NormalizedWeatherData;

/**
 * Five days of hourly data. `rainy` decides, per hour, whether it rains; everything else is a
 * calm, comfortable, dry hour.
 */
const series = (rainy: (time: number) => boolean): HourlyForecast[] =>
  Array.from({ length: 120 }, (_, index) => {
    const time = NOW + index * HOUR;
    const localHour = new Date(time + 10800_000).getUTCHours();
    const isDay = localHour >= 6 && localHour < 20;
    const wet = rainy(time);
    return {
      time: new Date(time),
      temp: 22,
      apparentTemperature: 22,
      humidity: 50,
      pop: wet ? 0.9 : 0,
      precipitationMm: wet ? 3 : 0,
      windSpeed: 3,
      windGust: 5,
      uvIndex: 2,
      visibility: 20000,
      weatherCode: wet ? 63 : 0,
      isDay,
      icon: isDay ? '01d' : '01n',
    } as HourlyForecast;
  });

const meta = () => ({
  provider: 'Open-Meteo',
  fetchedAt: new Date(),
  timezoneOffsetSeconds: 10800,
  intervalHours: 1,
  freshForSeconds: 1800,
});

describe('coming days and weekend compare (F4)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists today, tomorrow and named weekdays with a forecast label for later days', () => {
    render(
      <SettingsProvider>
        <DayOutlookPanel
          weather={weatherFor('İstanbul')}
          hourly={series(time => time >= SATURDAY(6) && time < SATURDAY(20))}
          forecastMeta={meta()}
        />
      </SettingsProvider>
    );

    const list = screen.getByRole('list');
    const days = within(list).getAllByRole('listitem');
    expect(days[0]).toHaveTextContent('Bugün');
    expect(days[1]).toHaveTextContent('Yarın');
    const saturday = days.find(day => day.textContent?.startsWith('Cumartesi'))!;
    expect(saturday).toHaveTextContent('Yağış riski yüksek');
    // Saturday is beyond 72 h: low confidence ("belirsiz tahmin"); tomorrow is "tahmini".
    expect(saturday).toHaveTextContent('belirsiz tahmin');
    expect(days[2]).toHaveTextContent('tahmini');
    expect(days[0]).not.toHaveTextContent('tahmini');
  });

  it('hides the multi-day outlook when fewer than two local days are usable', () => {
    // The 12-hour fixture stays inside one Istanbul-local date at the pinned test clock.
    render(
      <SettingsProvider>
        <DayOutlookPanel
          weather={weatherFor('İstanbul')}
          hourly={series(() => false).slice(0, 12)}
          forecastMeta={meta()}
        />
      </SettingsProvider>
    );

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('hides the multi-day outlook when forecast metadata is stale', () => {
    const staleMeta = {
      ...meta(),
      fetchedAt: new Date(NOW - 3 * HOUR),
    };

    render(
      <SettingsProvider>
        <DayOutlookPanel
          weather={weatherFor('İstanbul')}
          hourly={series(() => false)}
          forecastMeta={staleMeta}
        />
      </SettingsProvider>
    );

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('picks the weekend winner by that day, not by the next 12 hours', async () => {
    // İzmir is wet today, dry on Saturday; İstanbul is dry today, wet all Saturday daylight.
    const todayRain = (time: number) => time < NOW + 12 * HOUR;
    const saturdayRain = (time: number) => time >= SATURDAY(6) && time < SATURDAY(20);
    api.getCurrentWeather
      .mockReset()
      .mockImplementation(({ city }: { city: string }) => Promise.resolve(weatherFor(city)));
    api.getHourlyForecast
      .mockReset()
      .mockImplementation((lat: number) =>
        Promise.resolve({ hourly: series(lat === 41 ? saturdayRain : todayRain), meta: meta() })
      );
    api.getForecast.mockReset().mockResolvedValue({ daily: [], hourly: [], meta: meta() });
    api.getAirQuality.mockReset().mockRejectedValue(new Error('no air'));

    render(
      <SettingsProvider>
        <ComparePanel
          language="tr"
          cities={[
            { name: 'İstanbul', lat: 41, lon: 29 },
            { name: 'İzmir', lat: 38, lon: 27 },
          ]}
        />
      </SettingsProvider>
    );

    const status = await screen.findByText(/bu hava kriterlerinde öne çıkan/i);
    expect(status.closest('[role="status"]')).toHaveTextContent('İstanbul');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cumartesi' }));
    });
    const winner = screen.getByText(/Cumartesi için bu hava kriterlerinde öne çıkan/);
    expect(winner.closest('[role="status"]')).toHaveTextContent('İzmir');
    // "Now" metrics (current temperature, wind) are not shown next to a Saturday verdict.
    expect(screen.queryAllByText('Sıcaklık')).toHaveLength(0);
    expect(screen.getAllByText('Günün başlıca etkeni')).toHaveLength(2);
  });
});
