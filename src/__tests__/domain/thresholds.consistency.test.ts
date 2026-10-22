/**
 * Plan v3 Faz 0.4 — the same hourly input must get the same umbrella, wind and heat verdict
 * from the day plan (Gün planı), the Today headline (weatherDecisions) and the commute plan
 * (Çıkış planı), and the score's reason codes must agree with them (L8).
 */
import { describe, expect, it } from 'vitest';
import { buildCommutePlan } from '../../domain/commute/buildCommutePlan';
import { buildDailyPlan } from '../../domain/decision/buildDailyPlan';
import { scoreWeatherWindow } from '../../domain/decision/scoreWeatherWindow';
import {
  COLD_APPARENT_C,
  HEAT_APPARENT_C,
  RAIN_LIKELY_MM,
  RAIN_LIKELY_PROBABILITY,
  RAIN_POSSIBLE_PROBABILITY,
  WIND_CAUTION_SPEED,
  WIND_STRONG_GUST,
  WIND_STRONG_SPEED,
} from '../../domain/decision/thresholds';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';
import { getWeatherDecisions } from '../../utils/weatherDecisions';

const OFFSET = 10800;
const NOW = new Date('2026-08-28T05:00:00.000Z'); // 08:00 İstanbul
const HOUR_MS = 60 * 60 * 1000;

const weather: NormalizedWeatherData = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 20,
  feelsLike: 20,
  tempMin: 16,
  tempMax: 24,
  humidity: 50,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 2,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: new Date('2026-08-28T03:30:00.000Z'),
  sunset: new Date('2026-08-28T16:45:00.000Z'),
  timestamp: NOW,
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 0,
  meta: { provider: 'OpenWeather', fetchedAt: NOW, timezoneOffsetSeconds: OFFSET },
};

type Overrides = Partial<Omit<HourlyForecast, 'time'>>;

/** Twelve identical hours, so every module's horizon sees the same weather. */
const uniform = (overrides: Overrides): HourlyForecast[] =>
  Array.from({ length: 12 }, (_, index) => ({
    time: new Date(NOW.getTime() + (index + 1) * HOUR_MS),
    temp: 20,
    apparentTemperature: 20,
    humidity: 50,
    pop: 0,
    precipitationMm: 0,
    windSpeed: 2,
    windGust: 4,
    uvIndex: 1,
    visibility: 20000,
    weatherCode: 0,
    icon: '01d',
    ...overrides,
  }));

const verdicts = (overrides: Overrides, current: Partial<NormalizedWeatherData> = {}) => {
  const hourly = uniform(overrides);
  const now = { ...weather, ...current };
  const daily = buildDailyPlan({ weather: now, hourly });
  const decisions = getWeatherDecisions({ weather: now, hourly });
  const commute = buildCommutePlan({
    hourly,
    commuteStart: '10:00',
    commuteEnd: '14:00',
    timezoneOffsetSeconds: OFFSET,
    now: NOW,
  });
  const reasons = scoreWeatherWindow({
    time: hourly[0].time,
    temperature: hourly[0].temp,
    apparentTemperature: hourly[0].apparentTemperature,
    humidity: hourly[0].humidity,
    precipitationProbability: hourly[0].pop,
    precipitationMm: hourly[0].precipitationMm,
    windSpeed: hourly[0].windSpeed,
    windGust: hourly[0].windGust,
  }).reasons;
  if (!commute) throw new Error('commute plan missing');
  return { daily, decisions, commute, reasons, kinds: decisions.map(d => d.kind) };
};

describe('one threshold set across Gün planı, Bugün başlığı and Çıkış planı', () => {
  it.each([
    ['probability just over the likely line', { pop: RAIN_LIKELY_PROBABILITY + 0.02 }],
    ['amount just over the likely line', { pop: 0.2, precipitationMm: RAIN_LIKELY_MM + 0.1 }],
  ])('umbrella "yes" everywhere: %s', (_label, overrides) => {
    const { daily, kinds, commute, reasons } = verdicts(overrides);
    expect(daily.umbrella).toBe('yes');
    expect(kinds).toContain('rain');
    expect(commute.umbrella).toBe('take');
    expect(reasons).toContain('heavy-rain');
  });

  it('umbrella "maybe" everywhere for a possible shower, and no headline rain warning', () => {
    const { daily, kinds, commute, reasons } = verdicts({ pop: RAIN_POSSIBLE_PROBABILITY + 0.05 });
    expect(daily.umbrella).toBe('maybe');
    expect(kinds).not.toContain('rain');
    expect(commute.umbrella).toBe('consider');
    expect(reasons).toContain('rain-risk');
    expect(reasons).not.toContain('heavy-rain');
  });

  it('dry hours need no umbrella anywhere', () => {
    const { daily, kinds, commute } = verdicts({ pop: 0.05 });
    expect(daily.umbrella).toBe('no');
    expect(kinds).not.toContain('rain');
    expect(commute.umbrella).toBe('no');
  });

  it.each([
    ['sustained wind', { windSpeed: WIND_STRONG_SPEED + 0.5, windGust: WIND_STRONG_SPEED + 3 }],
    ['gusts only', { windSpeed: 6, windGust: WIND_STRONG_GUST + 1 }],
  ])('strong wind everywhere: %s', (_label, overrides) => {
    const { daily, decisions, commute, reasons } = verdicts(overrides);
    expect(daily.wind).toBe('strong');
    expect(decisions.find(d => d.kind === 'wind')?.severity).toBe('high');
    expect(commute.advice).toContain('strong-wind');
    expect(reasons).toContain('strong-wind');
  });

  it('wind caution everywhere just over the caution line', () => {
    const { daily, decisions, commute, reasons } = verdicts({
      windSpeed: WIND_CAUTION_SPEED + 0.5,
      windGust: WIND_CAUTION_SPEED + 2,
    });
    expect(daily.wind).toBe('caution');
    expect(decisions.find(d => d.kind === 'wind')?.severity).toBe('moderate');
    expect(commute.advice).toContain('wind-caution');
    expect(reasons).toContain('windy');
  });

  it('calm air has no wind warning anywhere', () => {
    const { daily, kinds, commute } = verdicts({ windSpeed: 4, windGust: 7 });
    expect(daily.wind).toBe('normal');
    expect(kinds).not.toContain('wind');
    expect(commute.advice).not.toContain('wind-caution');
    expect(commute.advice).not.toContain('strong-wind');
  });

  it('heat and cold use the same feels-like lines in the headline, commute and reasons', () => {
    const hot = verdicts(
      { temp: HEAT_APPARENT_C, apparentTemperature: HEAT_APPARENT_C + 0.5 },
      { feelsLike: 25 }
    );
    expect(hot.kinds).toContain('heat');
    expect(hot.commute.advice).toContain('heat');
    expect(hot.reasons).toContain('heat');

    const mild = verdicts(
      { temp: HEAT_APPARENT_C - 2, apparentTemperature: HEAT_APPARENT_C - 1 },
      { feelsLike: 25 }
    );
    expect(mild.kinds).not.toContain('heat');
    expect(mild.commute.advice).not.toContain('heat');
    expect(mild.reasons).not.toContain('heat');

    const cold = verdicts(
      { temp: COLD_APPARENT_C, apparentTemperature: COLD_APPARENT_C - 0.5 },
      { feelsLike: 12 }
    );
    expect(cold.kinds).toContain('cold');
    expect(cold.commute.advice).toContain('cold');
    expect(cold.reasons).toContain('cold');
  });
});
