import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CurrentWeatherMeta } from '../../types';
import { getCurrentWeatherFreshness } from '../../utils/currentWeatherFreshness';

const meta = (overrides: Partial<CurrentWeatherMeta> = {}): CurrentWeatherMeta => ({
  provider: 'OpenWeather',
  fetchedAt: new Date('2026-09-02T00:00:00Z'),
  timezoneOffsetSeconds: 10_800,
  ...overrides,
});

afterEach(() => vi.useRealTimers());

describe('getCurrentWeatherFreshness', () => {
  it('uses the current-weather fallback TTL when the provider omits one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T00:04:59Z'));
    expect(getCurrentWeatherFreshness(meta()).fresh).toBe(true);

    vi.setSystemTime(new Date('2026-09-02T00:05:01Z'));
    expect(getCurrentWeatherFreshness(meta()).fresh).toBe(false);
  });

  it('honors an explicit provider TTL and exposes a bounded expiry delay', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T00:00:10Z'));
    expect(getCurrentWeatherFreshness(meta({ freshForSeconds: 30 }))).toEqual({
      fresh: true,
      expiresInMs: 20_100,
    });
  });

  it('accepts an explicit clock for consumers that need one freshness decision per render', () => {
    expect(
      getCurrentWeatherFreshness(meta({ freshForSeconds: 30 }), Date.parse('2026-09-02T00:00:10Z'))
    ).toEqual({ fresh: true, expiresInMs: 20_100 });
  });

  it('fails closed for timestamps beyond the future-skew ceiling', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T00:00:00Z'));
    expect(
      getCurrentWeatherFreshness(meta({ fetchedAt: new Date('2026-09-02T00:01:01Z') })).fresh
    ).toBe(false);
  });
});
