import { describe, expect, it } from 'vitest';
import { getWeatherDecisions } from '../../utils/weatherDecisions';
import type { NormalizedWeatherData } from '../../types';

const weather: NormalizedWeatherData = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 24,
  feelsLike: 24,
  tempMin: 18,
  tempMax: 28,
  humidity: 60,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 4,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: new Date('2026-08-28T03:00:00Z'),
  sunset: new Date('2026-08-28T16:00:00Z'),
  timestamp: new Date('2026-08-28T09:00:00Z'),
  coordinates: { lat: 41, lon: 29 },
  clouds: 5,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(), timezoneOffsetSeconds: 10800 },
};

const point = (overrides: Partial<{ temp: number; pop: number; windSpeed: number }> = {}) => ({
  time: new Date('2026-08-28T12:00:00Z'),
  temp: overrides.temp ?? 24,
  icon: '01d' as const,
  pop: overrides.pop ?? 0.1,
  windSpeed: overrides.windSpeed ?? 4,
});

describe('getWeatherDecisions', () => {
  it('prioritizes heavy rain as a user action', () => {
    const result = getWeatherDecisions({ weather, hourly: [point({ pop: 0.8 })] });
    expect(result[0]).toMatchObject({ kind: 'rain', severity: 'high' });
  });

  it('detects strong wind and heat', () => {
    const result = getWeatherDecisions({ weather, hourly: [point({ temp: 36, windSpeed: 13 })] });
    expect(result.map(item => item.kind)).toEqual(expect.arrayContaining(['wind', 'heat']));
  });

  it('flags poor air quality and proposes a calm outdoor window', () => {
    const result = getWeatherDecisions({
      weather,
      hourly: [point({ temp: 20, pop: 0.05, windSpeed: 2 })],
      airQuality: { aqi: 4, aqiLabel: 'Sağlıksız', pm25: 30, pm10: 50, o3: 70 },
    });
    expect(result.map(item => item.kind)).toEqual(
      expect.arrayContaining(['air-quality', 'outdoor-window'])
    );
  });

  it('treats UV input as a modeled next-24-hour maximum, not a current reading', () => {
    const result = getWeatherDecisions({
      weather,
      hourly: [],
      uvIndexMax: 7.2,
    });
    expect(result[0]).toMatchObject({ kind: 'uv', severity: 'moderate', value: 7.2 });
  });

  it('returns stable when no actionable signal exists and no outdoor point is present', () => {
    const result = getWeatherDecisions({ weather, hourly: [] });
    expect(result).toEqual([{ kind: 'stable', severity: 'info' }]);
  });
});
