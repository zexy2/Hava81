import { describe, expect, it } from 'vitest';
import { getDailyPlanAirQualityEvidence } from '../../domain/decision/airQualityEvidence';
import type { AirQuality, AirQualityHourly } from '../../types';

const now = Date.UTC(2026, 9, 23, 11, 0, 0);
const forecastTimes = [0, 1, 2].map(offset => new Date(now + offset * 60 * 60_000));
const freshMeta = { provider: 'Open-Meteo', fetchedAt: new Date(now - 1_000), freshForSeconds: 600 };
const currentAir = (aqi: number, fetchedAt = new Date(now - 1_000), freshForSeconds = 600): AirQuality => ({
  aqi,
  aqiLabel: 'test',
  pm25: 5,
  pm10: 8,
  o3: 20,
  meta: { provider: 'OpenWeather', fetchedAt, freshForSeconds },
});
const hourlyAir = (hours: AirQualityHourly['hours'], fetchedAt = new Date(now - 1_000), freshForSeconds = 600): AirQualityHourly => ({
  hours,
  meta: { ...freshMeta, fetchedAt, freshForSeconds },
});

describe('daily-plan AQI evidence', () => {
  it('normalizes exact-hour European AQI and leaves unmatched hours uninterpolated', () => {
    const result = getDailyPlanAirQualityEvidence({
      forecastTimes,
      now,
      airQuality: currentAir(1),
      airQualityHourly: hourlyAir([
        { time: forecastTimes[0], europeanAqi: 100 },
        { time: forecastTimes[2], europeanAqi: 10 },
      ]),
    });

    expect(result.hourlyAqiByTime.get(forecastTimes[0].getTime())).toBe(5);
    expect(result.hourlyAqiByTime.get(forecastTimes[1].getTime())).toBeUndefined();
    expect(result.hourlyAqiByTime.get(forecastTimes[2].getTime())).toBe(1);
    expect(result.currentAirQuality?.aqi).toBe(1);
    expect(result.usesHourlyAqi).toBe(true);
    expect(result.usesCurrentAqiFallback).toBe(true);
  });

  it('ignores stale hourly and current evidence instead of turning it into a low-risk value', () => {
    const staleAt = new Date(now - 120_000);
    const result = getDailyPlanAirQualityEvidence({
      forecastTimes,
      now,
      airQuality: currentAir(1, staleAt, 30),
      airQualityHourly: hourlyAir(
        [{ time: forecastTimes[0], europeanAqi: 5 }],
        staleAt,
        30
      ),
    });

    expect(result.currentAirQuality).toBeUndefined();
    expect(result.hourlyAqiByTime.size).toBe(0);
    expect(result.usesHourlyAqi).toBe(false);
    expect(result.usesCurrentAqiFallback).toBe(false);
  });

  it('rejects invalid AQI and conflicting duplicate timestamps without guessing', () => {
    const result = getDailyPlanAirQualityEvidence({
      forecastTimes,
      now,
      airQualityHourly: hourlyAir([
        { time: forecastTimes[0], europeanAqi: 10 },
        { time: forecastTimes[0], europeanAqi: 90 },
        { time: forecastTimes[1], europeanAqi: -1 },
      ]),
    });

    expect(result.hourlyAqiByTime.get(forecastTimes[0].getTime())).toBeUndefined();
    expect(result.hourlyAqiByTime.has(forecastTimes[1].getTime())).toBe(false);
    expect(result.usesHourlyAqi).toBe(false);
  });
});
