import { describe, expect, it } from 'vitest';
import { getOptionalEvidenceFreshness } from '../../utils/optionalEvidenceFreshness';

describe('getOptionalEvidenceFreshness', () => {
  const now = new Date('2026-09-02T03:00:00Z').getTime();

  it('uses the five-minute compatibility TTL when metadata omits one', () => {
    const state = getOptionalEvidenceFreshness({ fetchedAt: new Date(now - 60_000) }, now);

    expect(state).toEqual({ fresh: true, expiresInMs: 240_100 });
  });

  it('fails closed for evidence beyond the allowed future skew', () => {
    expect(
      getOptionalEvidenceFreshness({ fetchedAt: new Date(now + 60_001), freshForSeconds: 300 }, now)
    ).toEqual({ fresh: false, expiresInMs: null });
  });

  it('keeps the exact TTL boundary fresh through the existing expiry cushion', () => {
    expect(
      getOptionalEvidenceFreshness({ fetchedAt: new Date(now - 30_000), freshForSeconds: 30 }, now)
    ).toEqual({ fresh: true, expiresInMs: 100 });
  });

  it('rejects invalid timestamps', () => {
    expect(getOptionalEvidenceFreshness({ fetchedAt: 'not-a-date' }, now)).toEqual({
      fresh: false,
      expiresInMs: null,
    });
  });
});
