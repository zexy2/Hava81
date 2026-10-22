/**
 * Plan v3 Faz 0.5 — "Şimdi uygun" and "en uygun 22:00–02:00" can never appear together:
 * now/later is derived from the same 12-hour best window the UI shows (L6).
 */
import { describe, expect, it } from 'vitest';
import { buildDecisionSnapshot } from '../../domain/decision/decisionSnapshot';
import { localHourOf } from '../../domain/decision/eligibility';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';

const OFFSET = 10800;
const HOUR_MS = 60 * 60 * 1000;

const weatherAt = (iso: string): NormalizedWeatherData => ({
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 20,
  feelsLike: 20,
  tempMin: 15,
  tempMax: 24,
  humidity: 50,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 2,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: new Date('2026-10-22T04:25:00.000Z'),
  sunset: new Date('2026-10-22T15:20:00.000Z'),
  timestamp: new Date(iso),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 0,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(iso), timezoneOffsetSeconds: OFFSET },
});

const series = (startIso: string, feels: number[], overrides: Partial<HourlyForecast> = {}) =>
  feels.map(
    (apparentTemperature, index): HourlyForecast => ({
      time: new Date(Date.parse(startIso) + index * HOUR_MS),
      temp: apparentTemperature,
      apparentTemperature,
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
    })
  );

const assertCoherent = (snapshot: ReturnType<typeof buildDecisionSnapshot>) => {
  const { plan, bestWindow } = snapshot;
  const current = plan.slots[0];
  if (plan.nowOrLater.kind === 'now') {
    expect(bestWindow).toBeDefined();
    expect(bestWindow!.start.time.getTime()).toBeLessThanOrEqual(current.time.getTime());
    expect(bestWindow!.end.time.getTime()).toBeGreaterThanOrEqual(current.time.getTime());
  }
  if (plan.nowOrLater.kind === 'later') {
    expect(bestWindow).toBeDefined();
    expect(bestWindow!.start.time.getTime()).toBeGreaterThan(current.time.getTime());
    expect(plan.nowOrLater.targetTime?.getTime()).toBe(bestWindow!.start.time.getTime());
  }
  if (plan.nowOrLater.kind === 'similar') expect(bestWindow).toBeUndefined();
};

describe('now/later follows the shown best window', () => {
  it('a good "now" with a slightly better window later is not "now" (no contradiction)', () => {
    // 09:00: 95-ish now, a near-perfect stretch from 13:00. The old rule said "now"
    // (current ≥ 88, improvement ≤ 3) while the window pointed at 13:00–16:00.
    const snapshot = buildDecisionSnapshot({
      weather: weatherAt('2026-10-22T06:00:00.000Z'),
      hourly: series('2026-10-22T06:00:00.000Z', [26, 27, 28, 28, 20, 20, 20, 20, 27, 28, 28, 28]),
    });
    assertCoherent(snapshot);
    expect(snapshot.plan.nowOrLater.kind).not.toBe('now');
  });

  it('says "now" when the best window contains the current hour', () => {
    const snapshot = buildDecisionSnapshot({
      weather: weatherAt('2026-10-22T06:00:00.000Z'),
      hourly: series('2026-10-22T06:00:00.000Z', [20, 20, 20, 24, 27, 29, 30, 30, 29, 28, 27, 26]),
    });
    assertCoherent(snapshot);
    expect(snapshot.plan.nowOrLater.kind).toBe('now');
  });

  it('after 23:00 points at tomorrow morning instead of showing nothing', () => {
    const snapshot = buildDecisionSnapshot({
      weather: weatherAt('2026-10-08T20:15:00.000Z'),
      hourly: series(
        '2026-10-08T21:00:00.000Z',
        Array.from({ length: 24 }, (_, index) => 18 + Math.min(index, 3)),
        { icon: '02n' }
      ),
    });
    assertCoherent(snapshot);
    expect(snapshot.plan.nowOrLater.kind).toBe('later');
    const startHour = localHourOf(snapshot.bestWindow!.start.time, OFFSET);
    expect(startHour).toBeGreaterThanOrEqual(7);
    expect(startHour).toBeLessThan(23);
  });

  it('never contradicts itself across many generated days', () => {
    const profiles = [
      [20, 22, 24, 26, 28, 30, 32, 31, 29, 27, 25, 23],
      [31, 30, 28, 26, 24, 22, 21, 20, 20, 21, 22, 23],
      [22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22],
      [5, 6, 8, 11, 14, 16, 17, 16, 14, 11, 9, 7],
      [35, 36, 37, 38, 36, 34, 31, 28, 26, 25, 24, 23],
    ];
    for (const startIso of [
      '2026-10-22T03:00:00.000Z',
      '2026-10-22T06:00:00.000Z',
      '2026-10-22T12:00:00.000Z',
      '2026-10-22T17:00:00.000Z',
      '2026-10-22T20:00:00.000Z',
    ]) {
      for (const feels of profiles) {
        for (const pop of [0, 0.3, 0.7]) {
          assertCoherent(
            buildDecisionSnapshot({
              weather: weatherAt(startIso),
              hourly: series(startIso, feels, { pop }),
            })
          );
        }
      }
    }
  });
});
