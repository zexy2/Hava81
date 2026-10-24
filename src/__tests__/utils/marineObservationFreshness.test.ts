import { describe, expect, it } from 'vitest';
import { getMarineObservationFreshness } from '../../utils/marineObservationFreshness';

describe('getMarineObservationFreshness', () => {
  const now = Date.parse('2026-08-28T06:00:00Z');

  it('normalizes location-local wall-clock timestamps independently of the browser timezone', () => {
    expect(getMarineObservationFreshness('2026-08-28T09:00', 3 * 60 * 60, now)).toMatchObject({
      status: 'fresh',
      ageMs: 0,
      expiresInMs: 7_200_100,
    });
  });

  it('does not apply the location offset to timestamps that already include a zone', () => {
    for (const observedAt of ['2026-08-28T06:00:00Z', '2026-08-28T09:00:00+03:00']) {
      expect(getMarineObservationFreshness(observedAt, 3 * 60 * 60, now)).toMatchObject({
        status: 'fresh',
        ageMs: 0,
      });
    }
  });

  it('supports western offsets and rejects malformed local timestamps', () => {
    expect(getMarineObservationFreshness('2026-08-28T02:00', -4 * 60 * 60, now)).toMatchObject({
      status: 'fresh',
      ageMs: 0,
    });
    expect(getMarineObservationFreshness('not-a-date', 3 * 60 * 60, now).status).toBe('unknown');
  });

  it('rejects source samples older than two hours even if the bundle was just fetched', () => {
    expect(
      getMarineObservationFreshness('2026-08-28T06:59:59', 3 * 60 * 60, now)
    ).toMatchObject({ status: 'stale', ageMs: 2 * 60 * 60 * 1000 + 1000, expiresInMs: null });
  });

  it('fails closed for missing timestamps, invalid offsets and materially future samples', () => {
    expect(getMarineObservationFreshness(undefined, 3 * 60 * 60, now).status).toBe('unknown');
    expect(getMarineObservationFreshness('2026-08-28T09:00', Number.NaN, now).status).toBe('unknown');
    expect(
      getMarineObservationFreshness('2026-08-28T09:02', 3 * 60 * 60, now).status
    ).toBe('unknown');
  });
});
