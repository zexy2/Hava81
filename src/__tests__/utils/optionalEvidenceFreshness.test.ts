import { describe, expect, it } from 'vitest';
import { getOptionalEvidenceFreshness } from '../../utils/optionalEvidenceFreshness';

describe('getOptionalEvidenceFreshness', () => {
  const now = new Date('2026-09-02T03:00:00Z').getTime();

  it('uses the five-minute compatibility TTL when metadata omits one', () => {
    const state = getOptionalEvidenceFreshness({ fetchedAt: new Date(now - 60_000) }, now);

    expect(state).toEqual({ fresh: true, status: 'fresh', expiresInMs: 240_100 });
  });

  it('fails closed for evidence beyond the allowed future skew', () => {
    expect(
      getOptionalEvidenceFreshness({ fetchedAt: new Date(now + 60_001), freshForSeconds: 300 }, now)
    ).toEqual({ fresh: false, status: 'unknown', expiresInMs: null });
  });

  it('keeps the exact TTL boundary fresh through the existing expiry cushion', () => {
    expect(
      getOptionalEvidenceFreshness({ fetchedAt: new Date(now - 30_000), freshForSeconds: 30 }, now)
    ).toEqual({ fresh: true, status: 'fresh', expiresInMs: 100 });
  });

  it('distinguishes valid expired evidence from unknown evidence', () => {
    expect(
      getOptionalEvidenceFreshness(
        { fetchedAt: new Date(now - 301_000), freshForSeconds: 300 },
        now
      )
    ).toEqual({ fresh: false, status: 'stale', expiresInMs: null });
  });

  it('rejects invalid timestamps', () => {
    expect(getOptionalEvidenceFreshness({ fetchedAt: 'not-a-date' }, now)).toEqual({
      fresh: false,
      status: 'unknown',
      expiresInMs: null,
    });
  });
});

describe('source observation age', () => {
  const sourceNow = Date.UTC(2026, 8, 2, 3, 0, 0);
  it('marks an old current AQI sample stale even when the BFF fetched it moments ago', () => {
    expect(
      getOptionalEvidenceFreshness({
        fetchedAt: new Date(sourceNow - 1_000),
        observedAt: new Date(sourceNow - 2 * 60 * 60_000 - 1),
        freshForSeconds: 300,
      }, sourceNow)
    ).toEqual({ fresh: false, status: 'stale', expiresInMs: null });
  });

  it('wakes at the earlier of cache expiry and the two-hour source-age boundary', () => {
    expect(
      getOptionalEvidenceFreshness({
        fetchedAt: new Date(sourceNow - 1_000),
        observedAt: new Date(sourceNow - 2 * 60 * 60_000),
        freshForSeconds: 300,
      }, sourceNow)
    ).toEqual({ fresh: true, status: 'fresh', expiresInMs: 100 });
  });

  it('fails closed for invalid or materially future source timestamps', () => {
    for (const observedAt of ['not-a-date', new Date(sourceNow + 60_001)]) {
      expect(
        getOptionalEvidenceFreshness({
          fetchedAt: new Date(sourceNow - 1_000),
          observedAt,
          freshForSeconds: 300,
        }, sourceNow)
      ).toEqual({ fresh: false, status: 'unknown', expiresInMs: null });
    }
  });
});
