import { describe, expect, it } from 'vitest';
import { buildDailyPlan } from '../../domain/decision/buildDailyPlan';
import { scoreWeatherWindow } from '../../domain/decision/scoreWeatherWindow';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';

const weather: NormalizedWeatherData = {
  cityName: 'İzmir',
  country: 'TR',
  temperature: 29,
  feelsLike: 29,
  tempMin: 24,
  tempMax: 34,
  humidity: 40,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 4,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: new Date('2026-08-28T03:30:00.000Z'),
  sunset: new Date('2026-08-28T16:45:00.000Z'),
  timestamp: new Date('2026-08-28T06:00:00.000Z'),
  coordinates: { lat: 38.42, lon: 27.14 },
  clouds: 0,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date('2026-08-28T06:00:00.000Z'),
    timezoneOffsetSeconds: 10800,
  },
};

const point = (hour: number, temp: number, pop = 0, windSpeed = 4): HourlyForecast => ({
  time: new Date(`2026-08-28T${String(hour).padStart(2, '0')}:00:00.000Z`),
  temp,
  pop,
  windSpeed,
  icon: '01d',
  description: 'açık',
});

describe('Hava81 daily decision engine', () => {
  it('keeps comfortable dry calm windows in the excellent band', () => {
    const result = scoreWeatherWindow({
      time: new Date(),
      temperature: 24,
      precipitationProbability: 0.05,
      windSpeed: 3,
      airQualityIndex: 1,
    });
    expect(result.score).toBe(100);
    expect(result.band).toBe('excellent');
    expect(result.reasons).toEqual([]);
  });

  it('penalizes compound heat, rain, wind and air-quality risk', () => {
    const result = scoreWeatherWindow({
      time: new Date(),
      temperature: 38,
      precipitationProbability: 0.8,
      windSpeed: 18,
      airQualityIndex: 5,
    });
    expect(result.score).toBe(0);
    expect(result.band).toBe('difficult');
    expect(result.reasons).toEqual(
      expect.arrayContaining(['extreme-heat', 'heavy-rain', 'strong-wind', 'poor-air-quality'])
    );
  });

  it('recommends waiting when a materially better window is approaching', () => {
    const hourly = [
      point(6, 38, 0.1, 5),
      point(9, 35, 0.1, 5),
      point(12, 29, 0.05, 4),
      point(15, 27, 0.05, 3),
    ];
    const plan = buildDailyPlan({
      weather,
      hourly,
      airQuality: { aqi: 1, aqiLabel: 'İyi', pm25: 5, pm10: 8, o3: 20 },
    });
    expect(plan.nowOrLater.kind).toBe('later');
    expect(plan.nowOrLater.improvement).toBeGreaterThanOrEqual(15);
    expect(plan.bestWindow?.score).toBe(100);
  });

  it('recommends an umbrella when near-term rain risk reaches fifty percent', () => {
    const plan = buildDailyPlan({
      weather,
      hourly: [point(6, 24, 0.1), point(9, 23, 0.55), point(12, 22, 0.2)],
    });
    expect(plan.umbrella).toBe('yes');
  });

  it('degrades the day score for unhealthy air', () => {
    const plan = buildDailyPlan({
      weather,
      hourly: [point(6, 24), point(9, 25), point(12, 26)],
      airQuality: { aqi: 4, aqiLabel: 'Sağlıksız', pm25: 40, pm10: 60, o3: 90 },
    });
    expect(plan.airQuality).toBe('poor');
    expect(plan.score).toBeLessThan(85);
  });

  it('lets a difficult period pull down the overall day score', () => {
    const hourly = [
      point(6, 24, 0.05, 3),
      point(9, 24, 0.05, 3),
      point(12, 40, 0.05, 3),
      point(15, 24, 0.05, 3),
      point(18, 24, 0.05, 3),
      point(21, 24, 0.05, 3),
    ];
    const plan = buildDailyPlan({ weather, hourly });
    const simpleAverage = Math.round(
      plan.slots.slice(0, 6).reduce((sum, slot) => sum + slot.score, 0) / 6
    );
    expect(plan.score).toBeLessThan(85);
    expect(plan.score).toBeLessThan(simpleAverage);
  });
});
