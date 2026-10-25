import { act, render } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDecisionSnapshot } from '../../domain/decision/decisionSnapshot';
import { DecisionGlance } from '../../components/hava81/DecisionGlance';
import type { AirQuality, ForecastMeta, HourlyForecast, NormalizedWeatherData } from '../../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'tr' },
  }),
}));

vi.mock('../../domain/decision/decisionSnapshot', () => ({
  getDecisionSnapshot: vi.fn(() => ({ plan: null, bestWindow: undefined })),
}));

const now = Date.parse('2026-10-08T12:00:00.000Z');
const weather: NormalizedWeatherData = {
  cityName: 'İzmir',
  country: 'TR',
  temperature: 25,
  feelsLike: 26,
  tempMin: 18,
  tempMax: 28,
  humidity: 55,
  pressure: 1013,
  visibility: 10000,
  windSpeed: 4,
  windDirection: 180,
  description: 'Parçalı bulutlu',
  icon: '02d',
  sunrise: new Date(now - 8 * 60 * 60_000),
  sunset: new Date(now + 4 * 60 * 60_000),
  timestamp: new Date(now),
  coordinates: { lat: 38.42, lon: 27.14 },
  clouds: 28,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date(now),
    timezoneOffsetSeconds: 10800,
    freshForSeconds: 600,
  },
};
const hourly: HourlyForecast[] = [
  { time: new Date(now + 60 * 60_000), temp: 25, icon: '02d', pop: 0.1, windSpeed: 4 },
];
const forecastMeta: ForecastMeta = {
  provider: 'OpenWeather',
  fetchedAt: new Date(now),
  timezoneOffsetSeconds: 10800,
  intervalHours: 1,
  freshForSeconds: 600,
};
const airQuality = (fetchedAt: number, freshForSeconds: number): AirQuality => ({
  aqi: 5,
  aqiLabel: 'Very poor',
  pm25: 150,
  pm10: 180,
  o3: 100,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(fetchedAt), freshForSeconds },
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  vi.mocked(getDecisionSnapshot).mockReturnValue({
    plan: null,
    bestWindow: undefined,
  } as unknown as ReturnType<typeof getDecisionSnapshot>);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DecisionGlance optional AQI freshness', () => {
  it('does not commit a redundant render just to schedule the freshness clock', () => {
    const onRender = vi.fn();
    render(
      <Profiler id="decision-glance" onRender={onRender}>
        <DecisionGlance weather={weather} hourly={hourly} forecastMeta={forecastMeta} />
      </Profiler>
    );

    expect(onRender).toHaveBeenCalledTimes(1);
  });

  it('does not pass stale current AQI into the headline decision snapshot', () => {
    render(
      <DecisionGlance
        weather={weather}
        hourly={hourly}
        airQuality={airQuality(now - 301_000, 300)}
        forecastMeta={forecastMeta}
      />
    );

    expect(getDecisionSnapshot).toHaveBeenCalledTimes(1);
    expect(getDecisionSnapshot).toHaveBeenCalledWith({
      weather,
      hourly,
      airQuality: undefined,
    });
  });

  it('recomputes the snapshot when a fresh AQI sample expires', () => {
    const freshAqi = airQuality(now, 10);
    render(
      <DecisionGlance weather={weather} hourly={hourly} airQuality={freshAqi} forecastMeta={forecastMeta} />
    );

    expect(getDecisionSnapshot).toHaveBeenLastCalledWith({
      weather,
      hourly,
      airQuality: freshAqi,
    });

    act(() => {
      vi.advanceTimersByTime(10_100);
    });

    expect(getDecisionSnapshot).toHaveBeenLastCalledWith({
      weather,
      hourly,
      airQuality: undefined,
    });
    expect(getDecisionSnapshot).toHaveBeenCalledTimes(2);
  });
});
