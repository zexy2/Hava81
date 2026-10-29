import { describe, expect, it } from 'vitest';
import {
  capitalizeFirst,
  formatCityClock,
  formatCityClockRange,
  formatCityDate,
  formatCityDateLabel,
  formatCityTime,
  formatFixed,
  formatNumber,
  formatWithUnit,
  localeFor,
} from '../../utils/format';

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
    expect(formatCityTime(d, 3 * 3600, 'en')).toBe('6:05 PM');
    expect(formatCityTime(undefined, 0, 'tr')).toBe('—');
  });
  it('never prints NaN', () => {
    expect(formatNumber(Number.NaN, 'tr')).toBe('—');
  });
});

describe('homepage clock, range and date label', () => {
  const ist = (language: string) => ({ language, timezoneOffsetSeconds: 3 * 3600 });
  const utc = (language: string) => ({ language, timezoneOffsetSeconds: 0 });

  it('formats TR as 24h with two-digit hour', () => {
    expect(formatCityClock(new Date('2026-10-28T04:00:00Z'), ist('tr'))).toBe('07:00');
    expect(formatCityClock(new Date('2026-10-28T04:30:00Z'), ist('tr'))).toBe('07:30');
    expect(formatCityClock(new Date('2026-10-28T21:00:00Z'), ist('tr'))).toBe('00:00');
    expect(formatCityClock(new Date('2026-10-28T20:15:00Z'), ist('tr'))).toBe('23:15');
  });

  it('formats EN as compact 12h', () => {
    expect(formatCityClock(new Date('2026-10-28T04:00:00Z'), ist('en'))).toBe('7 AM');
    expect(formatCityClock(new Date('2026-10-28T04:30:00Z'), ist('en'))).toBe('7:30 AM');
    expect(formatCityClock(new Date('2026-10-28T00:00:00Z'), utc('en'))).toBe('12 AM');
    expect(formatCityClock(new Date('2026-10-28T12:00:00Z'), utc('en'))).toBe('12 PM');
    expect(formatCityClock(new Date('2026-10-28T12:05:00Z'), utc('en-US'))).toBe('12:05 PM');
    expect(formatCityClock(new Date('2026-10-28T23:00:00Z'), utc('en'))).toBe('11 PM');
  });

  it('applies the city offset, not the browser zone', () => {
    const d = new Date('2026-10-28T23:30:00Z');
    expect(formatCityClock(d, utc('tr'))).toBe('23:30');
    expect(formatCityClock(d, ist('tr'))).toBe('02:30');
    expect(formatCityClock(d, { language: 'en', timezoneOffsetSeconds: -5 * 3600 })).toBe(
      '6:30 PM'
    );
  });

  it('returns a dash for missing or invalid dates', () => {
    expect(formatCityClock(null, ist('tr'))).toBe('—');
    expect(formatCityClock(undefined, ist('en'))).toBe('—');
    expect(formatCityClock(new Date('nope'), ist('en'))).toBe('—');
  });

  it('formats ranges', () => {
    const start = new Date('2026-10-28T07:00:00Z');
    const end = new Date('2026-10-28T11:00:00Z');
    expect(formatCityClockRange(start, end, ist('tr'))).toBe('10:00–14:00');
    expect(formatCityClockRange(start, end, ist('en'))).toBe('10 AM–2 PM');
  });

  it('formats full date labels', () => {
    const d = new Date('2026-10-28T09:00:00Z');
    expect(formatCityDateLabel(d, ist('en'))).toBe('Wednesday, Oct 28');
    expect(formatCityDateLabel(d, ist('tr'))).toBe('28 Ekim Çarşamba');
    // Late UTC evening is already the next day in İstanbul.
    const late = new Date('2026-10-28T22:00:00Z');
    expect(formatCityDateLabel(late, utc('tr'))).toBe('28 Ekim Çarşamba');
    expect(formatCityDateLabel(late, ist('tr'))).toBe('29 Ekim Perşembe');
    expect(formatCityDateLabel(late, ist('en'))).toBe('Thursday, Oct 29');
  });

  it('keeps the short date helper', () => {
    expect(formatCityDate(new Date('2026-10-28T09:00:00Z'), 0, 'tr')).toContain('28');
  });
});

describe('capitalizeFirst', () => {
  it('uses Turkish casing rules for TR', () => {
    expect(capitalizeFirst('ılık', 'tr')).toBe('Ilık');
    expect(capitalizeFirst('iyi', 'tr')).toBe('İyi');
    expect(capitalizeFirst('açık hava', 'tr')).toBe('Açık hava');
  });
  it('uses default casing for EN and only touches the first letter', () => {
    expect(capitalizeFirst('light rain', 'en')).toBe('Light rain');
    expect(capitalizeFirst('iced', 'en')).toBe('Iced');
  });
  it('handles empty input', () => {
    expect(capitalizeFirst('', 'tr')).toBe('');
    expect(capitalizeFirst(undefined, 'en')).toBe('');
    expect(capitalizeFirst(null, 'tr')).toBe('');
  });
});
