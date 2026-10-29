import { describe, expect, it } from 'vitest';
import { resolvePlanPeriod } from '../../domain/activity/periods';

/** Asked periods resolve in the city's local time (Istanbul, UTC+3). */
const OFFSET = 10800;
// Local wall clock → UTC ms. 2026-10-29 is a Thursday.
const local = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour - 3, minute);

describe('resolvePlanPeriod', () => {
  it('"now" keeps the default look-ahead', () => {
    expect(resolvePlanPeriod('now', local(29, 10), OFFSET)).toBeUndefined();
  });

  it('this evening is 17–23 local, starting now once it has begun', () => {
    expect(resolvePlanPeriod('evening', local(29, 10), OFFSET)).toEqual({
      startMs: local(29, 17),
      endMs: local(29, 23),
    });
    expect(resolvePlanPeriod('evening', local(29, 19, 30), OFFSET)).toEqual({
      startMs: local(29, 19, 30),
      endMs: local(29, 23),
    });
  });

  it('this evening has ended after 23:00', () => {
    expect(resolvePlanPeriod('evening', local(29, 23, 30), OFFSET)).toBeNull();
  });

  it('tomorrow is 07–22 local on the next day, also just after midnight UTC', () => {
    expect(resolvePlanPeriod('tomorrow', local(29, 2), OFFSET)).toEqual({
      startMs: local(30, 7),
      endMs: local(30, 22),
    });
  });

  it('the weekend is Saturday 07:00 to Sunday 22:00; on Sunday only Sunday remains', () => {
    expect(resolvePlanPeriod('weekend', local(29, 10), OFFSET)).toEqual({
      startMs: local(31, 7),
      endMs: local(32, 22),
    });
    expect(resolvePlanPeriod('weekend', local(32, 12), OFFSET)).toEqual({
      startMs: local(32, 12),
      endMs: local(32, 22),
    });
  });
});
