import { describe, expect, it } from 'vitest';
import { buildActivityPlan } from '../../domain/activity/buildActivityPlan';
import { evaluateRoutine } from '../../domain/routines/evaluateRoutine';
import type { Routine } from '../../domain/routines/types';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';

const OFFSET = 10800; // İstanbul, UTC+3
const HOUR_MS = 3_600_000;
const local = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour - 3, minute);
const NOW = local(29, 10);

const weather: NormalizedWeatherData = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 18,
  feelsLike: 18,
  tempMin: 14,
  tempMax: 20,
  humidity: 60,
  pressure: 1015,
  visibility: 10000,
  windSpeed: 3,
  windDirection: 40,
  description: 'açık',
  icon: '01d',
  sunrise: new Date(local(29, 7)),
  sunset: new Date(local(29, 18)),
  timestamp: new Date(NOW),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 0,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(NOW), timezoneOffsetSeconds: OFFSET },
};

const point = (timeMs: number): HourlyForecast => {
  const hour = new Date(timeMs + OFFSET * 1000).getUTCHours();
  const isDay = hour >= 7 && hour < 18;
  return {
    time: new Date(timeMs),
    temp: 17,
    apparentTemperature: 17,
    humidity: 55,
    pop: 0.05,
    precipitationMm: 0,
    windSpeed: 2.5,
    windGust: 4,
    uvIndex: isDay ? 2 : 0,
    visibility: 20000,
    weatherCode: 1,
    icon: isDay ? '01d' : '01n',
    isDay,
    description: 'açık',
  };
};
/** Hourly for `hourlyCount` hours from `fromMs`, then three-hourly steps. */
const forecast = (fromMs: number, hourlyCount: number, threeHourlyCount = 0) => [
  ...Array.from({ length: hourlyCount }, (_, i) => point(fromMs + i * HOUR_MS)),
  ...Array.from({ length: threeHourlyCount }, (_, i) =>
    point(fromMs + hourlyCount * HOUR_MS + i * 3 * HOUR_MS)
  ),
];
const localHour = (date: Date) => new Date(date.getTime() + OFFSET * 1000).getUTCHours();

describe('plan window regressions', () => {
  it('a one-slot period (22:30–23:00) never answers with a range before it or too short', () => {
    const now = new Date(local(29, 22, 30));
    const period = { startMs: local(29, 22, 30), endMs: local(29, 23) };
    const plan = buildActivityPlan({
      activity: 'bike',
      weather,
      hourly: forecast(local(29, 22), 24),
      now,
      period,
    });
    // Hourly data, 30 minutes left of a 60-minute ride: no window, not 22:00–23:00.
    expect(plan.bestWindowRange).toBeUndefined();
  });

  it('a three-hourly step covering a far period (day 4, 10:00–11:00) is evaluated', () => {
    // 48 hourly hours from 00:00 on the 29th, then 3-hourly: 09:00 on Nov 1 covers 09–12.
    const plan = buildActivityPlan({
      activity: 'bike',
      weather,
      hourly: forecast(local(29, 0), 48, 32),
      now: new Date(local(29, 0)),
      period: { startMs: local(32, 10), endMs: local(32, 11) },
    });
    expect(plan.windowUnavailable).toBeFalsy();
    expect(plan.bestWindowRange).toBeDefined();
    expect(plan.bestWindowRange!.start.time.getTime()).toBeGreaterThanOrEqual(local(32, 10));
  });

  it('a routine window shorter than the activity has no best window', () => {
    const short: Routine = {
      id: 'r',
      activity: 'walk',
      schedule: { kind: 'flexible', days: [4], from: '14:00', to: '14:30', durationMinutes: 60 },
      createdAt: 0,
      updatedAt: 0,
    };
    const result = evaluateRoutine(short, {
      weather,
      hourly: forecast(NOW, 36),
      sensitivity: 'balanced',
      tolerance: {},
      now: new Date(NOW),
    });
    expect(result.status).toBe('scored');
    if (result.status !== 'scored') return;
    expect(result.plan.bestWindowRange).toBeUndefined();
  });

  it('the routine duration replaces the profile duration', () => {
    const base = {
      activity: 'walk' as const,
      weather,
      hourly: forecast(NOW, 36),
      now: new Date(NOW),
    };
    expect(buildActivityPlan(base).durationMinutes).toBe(60);
    const long = buildActivityPlan({ ...base, durationMinutes: 180 });
    expect(long.durationMinutes).toBe(180);
    const range = long.bestWindowRange!;
    expect(range.endTime.getTime() - range.start.time.getTime()).toBeGreaterThanOrEqual(
      180 * 60_000
    );

    const routine: Routine = {
      id: 'r',
      activity: 'walk',
      schedule: { kind: 'flexible', days: [4], from: '11:00', to: '17:00', durationMinutes: 150 },
      createdAt: 0,
      updatedAt: 0,
    };
    const result = evaluateRoutine(routine, {
      weather,
      hourly: forecast(NOW, 36),
      sensitivity: 'balanced',
      tolerance: {},
      now: new Date(NOW),
    });
    expect(result.status === 'scored' && result.plan.durationMinutes).toBe(150);
  });

  it.each(['bike', 'dog', 'photo', 'motorcycle', 'walk', 'run'] as const)(
    '%s "now" at midnight never suggests a night hour (07:00–23:00)',
    activity => {
      const plan = buildActivityPlan({
        activity,
        weather,
        hourly: forecast(local(30, 0), 36),
        now: new Date(local(30, 0)),
      });
      const range = plan.bestWindowRange!;
      expect(range).toBeDefined();
      expect(localHour(range.start.time)).toBeGreaterThanOrEqual(7);
      expect(range.endTime.getTime()).toBeLessThanOrEqual(local(30, 23));
    }
  );
});
