import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForecastMeta } from '../../types';
import { getForecastFreshness } from '../../utils/forecastFreshness';

const meta = (fetchedAt: Date, freshForSeconds?: number): ForecastMeta => ({
  provider: 'OpenMeteo',
  fetchedAt,
  timezoneOffsetSeconds: 10800,
  intervalHours: 1,
  freshForSeconds,
});

describe('getForecastFreshness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T00:00:00.000Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('keeps provider-TTL evidence fresh only through its expiry boundary', () => {
    const state = getForecastFreshness(meta(new Date('2026-09-01T23:59:50.000Z'), 30));
    expect(state.fresh).toBe(true);
    expect(state.expiresInMs).toBe(20_100);

    vi.setSystemTime(new Date('2026-09-02T00:00:20.001Z'));
    expect(getForecastFreshness(meta(new Date('2026-09-01T23:59:50.000Z'), 30))).toEqual({
      fresh: false,
      expiresInMs: null,
    });
  });

  it('uses the API forecast fallback TTL and rejects excessive future skew', () => {
    expect(getForecastFreshness(meta(new Date('2026-09-01T23:30:01.000Z'))).fresh).toBe(true);
    expect(getForecastFreshness(meta(new Date('2026-09-01T23:29:59.000Z'))).fresh).toBe(false);
    expect(getForecastFreshness(meta(new Date('2026-09-02T00:01:01.000Z'), 1_800))).toEqual({
      fresh: false,
      expiresInMs: null,
    });
  });

  it('fails closed when freshness metadata cannot be interpreted', () => {
    expect(getForecastFreshness(null)).toEqual({ fresh: false, expiresInMs: null });
    expect(
      getForecastFreshness({ ...meta(new Date()), fetchedAt: new Date(Number.NaN) })
    ).toEqual({ fresh: false, expiresInMs: null });
  });
});
