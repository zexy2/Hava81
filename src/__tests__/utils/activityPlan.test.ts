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
});
