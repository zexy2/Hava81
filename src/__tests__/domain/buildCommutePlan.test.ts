import { describe, expect, it } from 'vitest';
import { buildCommutePlan } from '../../domain/commute/buildCommutePlan';
import type { HourlyForecast } from '../../types';

const point = (iso: string, temp: number, pop: number, windSpeed = 4): HourlyForecast => ({
  time: new Date(iso),
  temp,
  pop,
  windSpeed,
  icon: '01d',
});

describe('buildCommutePlan', () => {
  it('uses the next departure pair and turns the two forecast windows into a practical plan', () => {
    const hourly = [
      point('2026-08-29T03:00:00Z', 21, 0.05),
      point('2026-08-29T06:00:00Z', 23, 0.1),
      point('2026-08-29T09:00:00Z', 27, 0.15),
      point('2026-08-29T12:00:00Z', 28, 0.2),
      point('2026-08-29T15:00:00Z', 19, 0.65, 12),
      point('2026-08-29T18:00:00Z', 17, 0.7, 13),
    ];

    const plan = buildCommutePlan({
      hourly,
      commuteStart: '08:30',
      commuteEnd: '18:00',
      timezoneOffsetSeconds: 3 * 60 * 60,
      now: new Date('2026-08-28T16:00:00Z'),
    });

    expect(plan).not.toBeNull();
    expect(plan?.outbound.forecastTime.toISOString()).toBe('2026-08-29T06:00:00.000Z');
    expect(plan?.return.forecastTime.toISOString()).toBe('2026-08-29T15:00:00.000Z');
    expect(plan?.umbrella).toBe('take');
    expect(plan?.change).toBe('rain-increase');
    expect(plan?.changeValue).toBe(55);
  });

  it('returns null until both times are configured', () => {
    expect(
      buildCommutePlan({
        hourly: [point('2026-08-29T06:00:00Z', 23, 0.1)],
        commuteStart: '08:30',
        timezoneOffsetSeconds: 3 * 60 * 60,
      })
    ).toBeNull();
  });

  it('does not pretend a distant forecast point represents the saved routine time', () => {
    const plan = buildCommutePlan({
      hourly: [
        point('2026-08-29T03:00:00Z', 21, 0.05),
        point('2026-08-29T18:00:00Z', 17, 0.1),
      ],
      commuteStart: '12:00',
      commuteEnd: '15:00',
      timezoneOffsetSeconds: 3 * 60 * 60,
      now: new Date('2026-08-28T16:00:00Z'),
    });

    expect(plan).toBeNull();
  });

  it('gives heat preparation guidance even when an umbrella is unnecessary', () => {
    const hourly: HourlyForecast[] = [
      {
        time: new Date('2026-08-29T09:00:00Z'),
        temp: 31,
        apparentTemperature: 33,
        pop: 0,
        windSpeed: 4,
        icon: '01d',
      },
      {
        time: new Date('2026-08-29T12:00:00Z'),
        temp: 33,
        apparentTemperature: 35,
        pop: 0,
        windSpeed: 5,
        icon: '01d',
      },
    ];
    const plan = buildCommutePlan({
      hourly,
      commuteStart: '12:00',
      commuteEnd: '15:00',
      timezoneOffsetSeconds: 3 * 60 * 60,
      now: new Date('2026-08-29T06:00:00Z'),
      airQualityIndex: 4,
    });

    expect(plan?.umbrella).toBe('no');
    expect(plan?.advice).toContain('heat');
    expect(plan?.advice).toContain('poor-air');
    expect(plan?.primaryAdvice).toBe('heat');
    expect(plan?.summary.maxApparentTemperature).toBe(35);
  });
});
