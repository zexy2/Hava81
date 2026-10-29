import { describe, expect, it } from 'vitest';
import { classifyDailyRisk, findDailyWeatherRisk } from '../../domain/alerts/dailyRisk';
import type { DailyForecast } from '../../types';

const now = new Date('2026-10-21T12:00:00Z');
const day = (offset: number, patch: Partial<DailyForecast> = {}): DailyForecast => ({
  date: new Date(Date.UTC(2026, 9, 21 + offset)),
  tempMin: 10,
  tempMax: 20,
  icon: '02d',
  description: '',
  pop: 0.1,
  precipitationMm: 0,
  ...patch,
});

describe('findDailyWeatherRisk', () => {
  it('returns null for empty or calm forecasts', () => {
    expect(findDailyWeatherRisk(undefined, now)).toBeNull();
    expect(findDailyWeatherRisk([], now)).toBeNull();
    expect(findDailyWeatherRisk([day(0), day(1)], now)).toBeNull();
  });

  it('flags a thunderstorm icon as severe storm when rain is heavy', () => {
    const risk = findDailyWeatherRisk(
      [day(0), day(1, { icon: '11d', pop: 0.9, precipitationMm: 83 })],
      now
    );
    expect(risk).toMatchObject({ kind: 'storm', severity: 'severe', pop: 0.9, mm: 83 });
    expect(risk?.date.getUTCDate()).toBe(22);
  });

  it('treats a light storm as a warning', () => {
    expect(classifyDailyRisk(day(0, { icon: '11n', precipitationMm: 5 }))).toMatchObject({
      kind: 'storm',
      severity: 'warning',
    });
  });

  it('recognises WMO and OpenWeather thunderstorm codes when present', () => {
    expect(classifyDailyRisk({ ...day(0), weatherCode: 96 } as DailyForecast)?.kind).toBe('storm');
    expect(classifyDailyRisk({ ...day(0), weatherCode: 211 } as DailyForecast)?.kind).toBe('storm');
    expect(classifyDailyRisk({ ...day(0), weatherCode: 61 } as DailyForecast)).toBeNull();
  });

  it('applies heavy-rain thresholds at their boundaries', () => {
    expect(classifyDailyRisk(day(0, { pop: 0.7, precipitationMm: 20 }))).toMatchObject({
      kind: 'heavy-rain',
      severity: 'warning',
    });
    expect(classifyDailyRisk(day(0, { pop: 0.69, precipitationMm: 39 }))).toBeNull();
    expect(classifyDailyRisk(day(0, { pop: 0.2, precipitationMm: 40 }))).toMatchObject({
      severity: 'severe',
    });
    expect(classifyDailyRisk(day(0, { pop: Number.NaN, precipitationMm: undefined }))).toBeNull();
  });

  it('skips past days and stays inside the five-day horizon', () => {
    const past = day(-1, { icon: '11d' });
    expect(findDailyWeatherRisk([past, day(0)], now)).toBeNull();
    const far = [day(0), day(1), day(2), day(3), day(4), day(5, { precipitationMm: 50 })];
    expect(findDailyWeatherRisk(far, now)).toBeNull();
    expect(findDailyWeatherRisk(far, now.getTime() + 86_400_000)?.mm).toBe(50);
  });

  it('uses the city calendar date to decide what counts as today', () => {
    const lateNight = new Date('2026-10-21T22:30:00Z'); // 01:30 on the 22nd at UTC+3
    const days = [day(0, { icon: '11d' }), day(1)];
    expect(findDailyWeatherRisk(days, lateNight)?.kind).toBe('storm');
    expect(findDailyWeatherRisk(days, lateNight, 3 * 3600)).toBeNull();
  });
});
