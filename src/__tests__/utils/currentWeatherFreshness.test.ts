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
    expect(getCurrentWeatherFreshness(meta())).toMatchObject({ fresh: true, status: 'fresh' });

    vi.setSystemTime(new Date('2026-09-02T00:05:01Z'));
    expect(getCurrentWeatherFreshness(meta())).toMatchObject({
      fresh: false,
      status: 'stale',
      ageMinutes: 5,
      expiresInMs: null,
    });
  });

  it('honors an explicit provider TTL and exposes a bounded expiry delay', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T00:00:10Z'));
    expect(getCurrentWeatherFreshness(meta({ freshForSeconds: 30 }))).toEqual({
      fresh: true,
      status: 'fresh',
      ageMinutes: 0,
      expiresInMs: 20_100,
    });
  });

  it('accepts an explicit clock for consumers that need one freshness decision per render', () => {
    expect(
      getCurrentWeatherFreshness(meta({ freshForSeconds: 30 }), Date.parse('2026-09-02T00:00:10Z'))
    ).toEqual({ fresh: true, status: 'fresh', ageMinutes: 0, expiresInMs: 20_100 });
  });

  it('fails closed as unknown for timestamps beyond the future-skew ceiling', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T00:00:00Z'));
    expect(
      getCurrentWeatherFreshness(meta({ fetchedAt: new Date('2026-09-02T00:01:01Z') }))
    ).toEqual({ fresh: false, status: 'unknown', ageMinutes: null, expiresInMs: null });
  });

  it('fails closed as unknown for missing or invalid fetch timestamps', () => {
    expect(getCurrentWeatherFreshness(null)).toEqual({
      fresh: false,
      status: 'unknown',
      ageMinutes: null,
      expiresInMs: null,
    });
    expect(getCurrentWeatherFreshness(meta({ fetchedAt: new Date('invalid') }))).toEqual({
      fresh: false,
      status: 'unknown',
      ageMinutes: null,
      expiresInMs: null,
    });
  });
});
