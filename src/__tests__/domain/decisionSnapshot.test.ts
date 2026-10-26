import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDecisionSnapshot, next24hRange } from '../../domain/decision/decisionSnapshot';
import { getWeatherDecisions } from '../../utils/weatherDecisions';
import type { AirQualityHourly, HourlyForecast, NormalizedWeatherData } from '../../types';

const start = Date.UTC(2026, 9, 21, 12);
const hourly = Array.from({ length: 30 }, (_, i) => ({
  time: new Date(start + i * 3600_000),
  temp: 12 + (i % 24 < 6 ? i % 24 : 12 - (i % 24) / 2),
  pop: 0,
  windSpeed: 2,
  humidity: 55,
  icon: '01d',
  description: 'açık',
})) as unknown as HourlyForecast[];
const weather = {
  cityName: 'İstanbul',
  temperature: 18,
  description: 'açık',
  icon: '01d',
  windSpeed: 1.6,
  timestamp: new Date(start),
  meta: { timezoneOffsetSeconds: 10800 },
} as unknown as NormalizedWeatherData;

describe('decision snapshot (Faz 1.1)', () => {
  // The snapshot drops forecast steps that already ended, so pin the clock to the fixture.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(start));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is computed once and shared across surfaces', () => {
    expect(getDecisionSnapshot({ weather, hourly })).toBe(getDecisionSnapshot({ weather, hourly }));
  });
  it('recomputes the cached snapshot when hourly AQI evidence changes', () => {
    const withoutAqi = getDecisionSnapshot({ weather, hourly });
    const airQualityHourly: AirQualityHourly = {
      hours: [{ time: hourly[0]!.time, europeanAqi: 100 }],
      meta: { provider: 'Open-Meteo', fetchedAt: new Date(), freshForSeconds: 3600 },
    };
    const withAqi = getDecisionSnapshot({ weather, hourly, airQualityHourly });

    expect(withAqi).not.toBe(withoutAqi);
    expect(withAqi.plan.slots[0]?.reasons).toContain('poor-air-quality');
  });
  it('expires cached decisions when hourly AQI evidence becomes stale', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(start));
      const airQualityHourly: AirQualityHourly = {
        hours: [{ time: hourly[0]!.time, europeanAqi: 100 }],
        meta: { provider: 'Open-Meteo', fetchedAt: new Date(), freshForSeconds: 30 },
      };
      const fresh = getDecisionSnapshot({ weather, hourly, airQualityHourly });
      expect(fresh.plan.slots[0]?.reasons).toContain('poor-air-quality');

      vi.advanceTimersByTime(30_101);
      const expired = getDecisionSnapshot({ weather, hourly, airQualityHourly });
      expect(expired).not.toBe(fresh);
      expect(expired.plan.slots[0]?.reasons).not.toContain('poor-air-quality');
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides the best window when near hours are similar', () => {
    const s = getDecisionSnapshot({ weather, hourly });
    if (s.plan.nowOrLater.kind === 'similar') expect(s.bestWindow).toBeUndefined();
    else expect(s.bestWindow).toBe(s.plan.bestWindowRange);
  });
  it('decision field outdoor window agrees with the snapshot', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(start - 3_600_000));
    try {
      const now = new Date(start - 3_600_000);
      const testWeather = { ...weather };
      const testHourly = [...hourly];
      const s = getDecisionSnapshot({ weather: testWeather, hourly: testHourly });
      const decisions = getWeatherDecisions({
        weather: testWeather,
        hourly: testHourly,
        now,
        bestWindowTime: s.bestWindow?.peak.time ?? null,
      });
      const outdoor = decisions.find(d => d.kind === 'outdoor-window');
      if (!s.bestWindow) expect(outdoor).toBeUndefined();
      else if (outdoor) expect(outdoor.time?.getTime()).toBe(s.bestWindow.peak.time.getTime());
    } finally {
      vi.useRealTimers();
    }
  });
  it('next24h ignores hours beyond 24h', () => {
    const r = next24hRange(hourly)!;
    const temps = hourly.slice(0, 24).map(h => h.temp);
    expect(r).toEqual({ min: Math.min(...temps), max: Math.max(...temps) });
  });
});
