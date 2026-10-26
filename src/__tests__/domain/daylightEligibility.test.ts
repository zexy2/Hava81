/**
 * Plan v3 Faz 0.3 — never recommend dark hours for daytime activities, and keep walk/run
 * (and the general day plan) inside 07–23 local.
 */
import { describe, expect, it } from 'vitest';
import { buildActivityPlan } from '../../domain/activity/buildActivityPlan';
import type { ActivityKind } from '../../domain/activity/types';
import { findBestWindowRange } from '../../domain/decision/bestWindowRange';
import { buildDailyPlan } from '../../domain/decision/buildDailyPlan';
import {
  isDaylightPoint,
  isRecommendableHour,
  localHourOf,
} from '../../domain/decision/eligibility';
import { scoreWeatherWindow } from '../../domain/decision/scoreWeatherWindow';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';

const OFFSET = 10800; // Türkiye, UTC+3
const HOUR_MS = 60 * 60 * 1000;
// 22 Ekim 2026 21:00 İstanbul (18:00Z): the evening the plan's evidence was captured.
const NOW = Date.parse('2026-10-22T18:00:00.000Z');
// Sunrise ≈ 07:25, sunset ≈ 18:20 local (04:25Z / 15:20Z).
const isDayAt = (time: Date) => {
  const hour = localHourOf(time, OFFSET);
  return hour >= 8 && hour < 18;
};

const weather: NormalizedWeatherData = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 17,
  feelsLike: 17,
  tempMin: 13,
  tempMax: 20,
  humidity: 70,
  pressure: 1015,
  visibility: 10000,
  windSpeed: 3,
  windDirection: 40,
  description: 'açık',
  icon: '01n',
  sunrise: new Date('2026-10-22T04:25:00.000Z'),
  sunset: new Date('2026-10-22T15:20:00.000Z'),
  timestamp: new Date(NOW),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 0,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(NOW), timezoneOffsetSeconds: OFFSET },
};

/**
 * 36 hours from 21:00 local. Calm, dry nights at a comfortable feels-like (the conditions
 * that made "Koşu 100, piknik 100, en uygun 21:00–01:00" happen), and a windier, warmer day
 * so that only the eligibility rule can keep the night out of the recommendation.
 */
const evening = (overrides: (time: Date, index: number) => Partial<HourlyForecast> = () => ({})) =>
  Array.from({ length: 36 }, (_, index): HourlyForecast => {
    const time = new Date(NOW + index * HOUR_MS);
    const isDay = isDayAt(time);
    return {
      time,
      temp: isDay ? 24 : 18,
      apparentTemperature: isDay ? 25 : 18,
      humidity: isDay ? 45 : 60,
      pop: isDay ? 0.15 : 0,
      precipitationMm: 0,
      windSpeed: isDay ? 7 : 2,
      windGust: isDay ? 12 : 4,
      uvIndex: isDay ? 4 : 0,
      visibility: 20000,
      weatherCode: 0,
      icon: isDay ? '01d' : '01n',
      isDay,
      ...overrides(time, index),
    };
  });

const localHours = (range?: { start: { time: Date }; end: { time: Date } }) => {
  if (!range) return [];
  const hours: number[] = [];
  for (let t = range.start.time.getTime(); t <= range.end.time.getTime(); t += HOUR_MS) {
    hours.push(localHourOf(new Date(t), OFFSET));
  }
  return hours;
};

describe('eligibility helpers', () => {
  it('reads API isDay first, then the icon suffix, and never assumes daylight when unknown', () => {
    expect(isDaylightPoint({ isDay: false, icon: '01d' })).toBe(false);
    expect(isDaylightPoint({ isDay: true, icon: '01n' })).toBe(true);
    expect(isDaylightPoint({ icon: '02n' })).toBe(false);
    expect(isDaylightPoint({ icon: '02d' })).toBe(true);
    expect(isDaylightPoint({})).toBe(false);
  });

  it('applies the daylight gate to picnic/children/laundry and 07–23 to walk/run/general', () => {
    const at = (hourLocal: number, isDay: boolean) => ({
      time: new Date(Date.UTC(2026, 9, 23, hourLocal - 3)),
      isDay,
    });
    for (const activity of ['picnic', 'children', 'laundry'] as ActivityKind[]) {
      expect(isRecommendableHour(at(22, false), OFFSET, activity)).toBe(false);
      expect(isRecommendableHour(at(6, false), OFFSET, activity)).toBe(false);
      expect(isRecommendableHour(at(12, true), OFFSET, activity)).toBe(true);
    }
    for (const activity of ['walk', 'run', undefined] as Array<ActivityKind | undefined>) {
      expect(isRecommendableHour(at(6, false), OFFSET, activity)).toBe(false);
      expect(isRecommendableHour(at(7, true), OFFSET, activity)).toBe(true);
      expect(isRecommendableHour(at(22, false), OFFSET, activity)).toBe(true);
      expect(isRecommendableHour(at(23, false), OFFSET, activity)).toBe(false);
      expect(isRecommendableHour(at(2, false), OFFSET, activity)).toBe(false);
    }
    expect(isRecommendableHour(at(2, false), OFFSET, 'motorcycle')).toBe(true);
  });
});

describe('findBestWindowRange isEligible', () => {
  it('never picks an ineligible peak and does not grow across ineligible hours', () => {
    const slots = [70, 99, 99, 80, 79].map((target, index) => {
      const slot = scoreWeatherWindow({
        time: new Date(NOW + index * HOUR_MS),
        temperature: 20,
        windSpeed: 2,
      });
      return { ...slot, score: target };
    });
    const ineligible = new Set([slots[1], slots[2]]);
    const range = findBestWindowRange(slots, undefined, slot => !ineligible.has(slot));
    expect(range?.peak).toBe(slots[3]);
    expect(range?.start).toBe(slots[3]);
    expect(range?.end).toBe(slots[4]);
    expect(findBestWindowRange(slots, undefined, () => false)).toBeUndefined();
  });
});

describe('day plan (Hava81 Skoru) at 21:00 İstanbul', () => {
  it('does not recommend 21:00–01:00 or any hour outside 07–23', () => {
    const plan = buildDailyPlan({ weather, hourly: evening() });
    const hours = localHours(plan.bestWindowRange);
    expect(hours.length).toBeGreaterThan(0);
    expect(hours.every(hour => hour >= 7 && hour < 23)).toBe(true);
    expect(hours).not.toContain(0);
    expect(hours).not.toContain(1);
    // The night still appears on the timeline with its score.
    expect(plan.slots.some(slot => localHourOf(slot.time, OFFSET) === 2)).toBe(true);
  });

  it('never advises waiting for a night hour', () => {
    // A hot muggy 21:00 then a cool 01:00: before Faz 0.3 "later" pointed at the night.
    const plan = buildDailyPlan({
      weather,
      hourly: evening((_time, index) =>
        index < 3 ? { temp: 33, apparentTemperature: 37, humidity: 70 } : {}
      ),
    });
    if (plan.nowOrLater.kind === 'later') {
      const hour = localHourOf(plan.nowOrLater.targetTime as Date, OFFSET);
      expect(hour >= 7 && hour < 23).toBe(true);
    }
  });
});

describe('activities at 21:00', () => {
  const plan = (activity: ActivityKind, hourly = evening()) =>
    buildActivityPlan({ activity, weather, hourly });

  it.each(['picnic', 'children', 'laundry'] as ActivityKind[])(
    '%s only recommends daylight hours',
    activity => {
      const result = plan(activity);
      expect(result.bestWindowRange).toBeDefined();
      const range = result.bestWindowRange!;
      for (let t = range.start.time.getTime(); t <= range.end.time.getTime(); t += HOUR_MS) {
        expect(isDayAt(new Date(t))).toBe(true);
      }
    }
  );

  it('laundry in Antalya never lands on 01:00–05:00', () => {
    // Dry, calm, warm night (the Antalya evidence) versus a breezier humid morning.
    const hourly = evening(time => {
      const day = isDayAt(time);
      return day
        ? { temp: 27, apparentTemperature: 29, humidity: 65, windSpeed: 6 }
        : { temp: 22, apparentTemperature: 22, humidity: 50, windSpeed: 2 };
    });
    const range = plan('laundry', hourly).bestWindowRange;
    const hours = localHours(range);
    expect(hours.length).toBeGreaterThan(0);
    for (const hour of [1, 2, 3, 4, 5]) expect(hours).not.toContain(hour);
  });

  it.each(['walk', 'run'] as ActivityKind[])('%s stays inside 07–23 local', activity => {
    const hours = localHours(plan(activity).bestWindowRange);
    expect(hours.length).toBeGreaterThan(0);
    expect(hours.every(hour => hour >= 7 && hour < 23)).toBe(true);
  });

  it('looks 24 hours ahead when the next 12 hours are all dark (winter picnic)', () => {
    // Every hour of the first 12 is dark: still a daylight window, not "no window".
    const hourly = evening((_time, index) =>
      index < 13 ? { isDay: false, icon: '01n' } : { isDay: true, icon: '01d' }
    );
    const range = plan('picnic', hourly).bestWindowRange;
    expect(range).toBeDefined();
    expect(range!.start.time.getTime()).toBeGreaterThanOrEqual(NOW + 13 * HOUR_MS);
  });

  it('a user-selected night range for a picnic reports no window instead of a dark hour', () => {
    const result = buildActivityPlan({
      activity: 'picnic',
      weather,
      hourly: evening(),
      preferredStart: '21:00',
      preferredEnd: '23:00',
    });
    expect(result.bestWindowRange).toBeUndefined();
  });
});
