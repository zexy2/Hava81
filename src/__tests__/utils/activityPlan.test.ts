import { describe, expect, it } from 'vitest';
import { buildActivityPlan } from '../../domain/activity/buildActivityPlan';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';

const weather: NormalizedWeatherData = {
  cityName: 'İzmir',
  country: 'TR',
  temperature: 30,
  feelsLike: 31,
  tempMin: 24,
  tempMax: 35,
  humidity: 45,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 5,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: new Date(),
  sunset: new Date(),
  timestamp: new Date('2026-08-28T09:00:00Z'),
  coordinates: { lat: 38.42, lon: 27.14 },
  clouds: 0,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(), timezoneOffsetSeconds: 10800 },
};
const hourly = (
  temps: number[],
  pops = temps.map(() => 0.05),
  winds = temps.map(() => 4)
): HourlyForecast[] =>
  temps.map((temp, index) => ({
    time: new Date(Date.UTC(2026, 7, 28, 9 + index * 3)),
    temp,
    pop: pops[index],
    windSpeed: winds[index],
    icon: '01d',
  }));

describe('activity plans', () => {
  it('penalizes heat for running more than laundry drying', () => {
    const points = hourly([35, 36, 34, 30]);
    const run = buildActivityPlan({ activity: 'run', weather, hourly: points });
    const laundry = buildActivityPlan({ activity: 'laundry', weather, hourly: points });
    expect(run.score).toBeLessThan(laundry.score);
    expect(run.activityImpact).toBeLessThan(laundry.activityImpact);
    expect(run.score).toBe(run.baselineScore + run.activityImpact);
  });

  it('penalizes wind and rain strongly for motorcycle', () => {
    const points = hourly([22, 22, 22], [0.6, 0.5, 0.3], [13, 15, 12]);
    const plan = buildActivityPlan({ activity: 'motorcycle', weather, hourly: points });
    expect(plan.score).toBeLessThan(40);
    expect(plan.reasons).toContain('strong-wind');
    expect(plan.reasons).toContain('heavy-rain');
  });

  it('makes poor AQI matter more for children than picnic', () => {
    const points = hourly([22, 23, 24]);
    const air = { aqi: 4, aqiLabel: 'Sağlıksız', pm25: 40, pm10: 60, o3: 80 };
    const children = buildActivityPlan({
      activity: 'children',
      weather,
      hourly: points,
      airQuality: air,
    });
    const picnic = buildActivityPlan({
      activity: 'picnic',
      weather,
      hourly: points,
      airQuality: air,
    });
    expect(children.score).toBeLessThan(picnic.score);
  });

  it('temperature sensitivity shifts activity comfort', () => {
    const points = hourly([30, 31, 32]);
    const heatSensitive = buildActivityPlan({
      activity: 'walk',
      weather,
      hourly: points,
      sensitivity: 'heat',
    });
    const coldSensitive = buildActivityPlan({
      activity: 'walk',
      weather,
      hourly: points,
      sensitivity: 'cold',
    });
    expect(heatSensitive.score).toBeLessThan(coldSensitive.score);
  });

  it('recalculates the score and best time inside a user-selected clock range', () => {
    const points: HourlyForecast[] = [
      { time: new Date('2026-08-28T09:00:00Z'), temp: 18, apparentTemperature: 18, pop: 0, windSpeed: 2, icon: '01d' },
      { time: new Date('2026-08-28T15:00:00Z'), temp: 30, apparentTemperature: 31, pop: 0, windSpeed: 4, icon: '01d' },
      { time: new Date('2026-08-28T16:00:00Z'), temp: 31, apparentTemperature: 32, pop: 0, windSpeed: 4, icon: '01d' },
      { time: new Date('2026-08-28T17:00:00Z'), temp: 32, apparentTemperature: 33, pop: 0, windSpeed: 4, icon: '01d' },
    ];
    const unfiltered = buildActivityPlan({ activity: 'run', weather, hourly: points });
    const filtered = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      preferredStart: '18:00',
      preferredEnd: '20:00',
    });

    expect(filtered.windowApplied).toEqual({ start: '18:00', end: '20:00' });
    expect(filtered.windowUnavailable).toBe(false);
    expect(filtered.score).toBeLessThan(unfiltered.score);
    expect(filtered.bestWindow).toBeDefined();
    const localBest = new Date(filtered.bestWindow!.time.getTime() + 3 * 60 * 60_000);
    expect(localBest.getUTCHours()).toBeGreaterThanOrEqual(18);
    expect(localBest.getUTCHours()).toBeLessThanOrEqual(20);
  });

  it('wraps a selected clock range across midnight', () => {
    const points: HourlyForecast[] = [
      { time: new Date('2026-08-28T18:00:00Z'), temp: 35, pop: 0, windSpeed: 2, icon: '01n' },
      { time: new Date('2026-08-28T19:00:00Z'), temp: 22, pop: 0, windSpeed: 2, icon: '01n' },
      { time: new Date('2026-08-28T22:00:00Z'), temp: 18, pop: 0, windSpeed: 2, icon: '01n' },
      { time: new Date('2026-08-29T00:00:00Z'), temp: 36, pop: 0, windSpeed: 2, icon: '01n' },
    ];
    const filtered = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      preferredStart: '22:00',
      preferredEnd: '02:00',
    });

    expect(filtered.windowUnavailable).toBe(false);
    expect(filtered.bestWindow?.time.toISOString()).toBe('2026-08-28T19:00:00.000Z');
  });

  it('treats equal start and end clocks as that selected instant, not a hidden full-day range', () => {
    const points: HourlyForecast[] = [
      { time: new Date('2026-08-28T15:00:00Z'), temp: 36, pop: 0, windSpeed: 2, icon: '01d' },
      { time: new Date('2026-08-28T16:00:00Z'), temp: 18, pop: 0, windSpeed: 2, icon: '01d' },
    ];
    const filtered = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      preferredStart: '18:00',
      preferredEnd: '18:00',
    });

    expect(filtered.windowUnavailable).toBe(false);
    expect(filtered.bestWindow?.time.toISOString()).toBe('2026-08-28T15:00:00.000Z');
    expect(filtered.score).toBe(filtered.bestWindow?.score);
  });

  it('reports an unavailable selected window instead of inventing a best time', () => {
    const points: HourlyForecast[] = [
      { time: new Date('2026-08-28T09:00:00Z'), temp: 20, pop: 0, windSpeed: 2, icon: '01d' },
      { time: new Date('2026-08-28T10:00:00Z'), temp: 21, pop: 0, windSpeed: 2, icon: '01d' },
    ];
    const filtered = buildActivityPlan({
      activity: 'walk',
      weather,
      hourly: points,
      preferredStart: '23:00',
      preferredEnd: '23:30',
    });
    expect(filtered.windowUnavailable).toBe(true);
    expect(filtered.bestWindow).toBeUndefined();
  });

});
