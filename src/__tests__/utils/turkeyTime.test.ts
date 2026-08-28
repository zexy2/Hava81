import { describe, expect, it } from 'vitest';
import {
  formatTurkeyTime,
  parseTurkeyLocalInputValue,
  toTurkeyLocalInputValue,
} from '../../utils/turkeyTime';

describe('Turkey route time helpers', () => {
  it('renders datetime-local values in Türkiye time independently of the runtime timezone', () => {
    expect(toTurkeyLocalInputValue(new Date('2026-08-28T21:30:00.000Z'))).toBe('2026-08-29T00:30');
  });

  it('converts a Türkiye wall-clock departure back to the correct UTC instant', () => {
    expect(parseTurkeyLocalInputValue('2026-08-29T00:30')?.toISOString()).toBe(
      '2026-08-28T21:30:00.000Z'
    );
  });

  it('formats route result timestamps in Türkiye time', () => {
    expect(formatTurkeyTime(new Date('2026-08-28T21:30:00.000Z'), 'tr-TR')).toBe('00:30');
  });

  it('rejects malformed local departures', () => {
    expect(parseTurkeyLocalInputValue('2026-08-29 00:30')).toBeNull();
  });
});
