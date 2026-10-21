import { describe, expect, it } from 'vitest';
import { formatCityTime, formatFixed, formatNumber, formatWithUnit, localeFor } from '../../utils/format';

describe('format.ts (Faz 1.4)', () => {
  it('uses the Turkish decimal comma', () => {
    expect(formatNumber(1.6, 'tr')).toBe('1,6');
    expect(formatWithUnit(0.8, 'm/s', 'tr')).toBe('0,8 m/s');
    expect(formatFixed(2, 'tr', 1)).toBe('2,0');
  });
  it('uses the English decimal point', () => {
    expect(formatNumber(1.6, 'en')).toBe('1.6');
    expect(localeFor('en-US')).toBe('en-GB');
  });
  it('formats city-local 24h time', () => {
    const d = new Date(Date.UTC(2026, 9, 21, 15, 5));
    expect(formatCityTime(d, 3 * 3600, 'tr')).toBe('18:05');
    expect(formatCityTime(d, 3 * 3600, 'en')).toBe('18:05');
    expect(formatCityTime(undefined, 0, 'tr')).toBe('—');
  });
  it('never prints NaN', () => {
    expect(formatNumber(Number.NaN, 'tr')).toBe('—');
  });
});
