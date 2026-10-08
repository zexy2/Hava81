import { describe, expect, it } from 'vitest';
import { formatBestWindowTime } from '../utils/formatBestWindowTime';

const date = (value: string) => new Date(value);
const istanbul = {
  now: date('2026-10-08T20:15:00.000Z'), // 23:15, October 8 in UTC+3
  timezoneOffsetSeconds: 3 * 3600,
  language: 'tr',
  todayLabel: 'Bugün',
  tomorrowLabel: 'Yarın',
};

describe('formatBestWindowTime calendar-day semantics', () => {
  it('labels tomorrow instead of presenting a next-day morning as today', () => {
    expect(formatBestWindowTime({
      ...istanbul,
      start: date('2026-10-09T03:00:00Z'),
      end: date('2026-10-09T07:00:00Z'),
    })).toBe('Yarın 06:00–10:00');
  });

  it('keeps today-only windows compact', () => {
    expect(formatBestWindowTime({
      ...istanbul,
      start: date('2026-10-08T20:30:00Z'),
      end: date('2026-10-08T20:30:00Z'),
    })).toBe('23:30');
  });

  it('labels both days when the best window crosses midnight', () => {
    expect(formatBestWindowTime({
      ...istanbul,
      start: date('2026-10-08T20:30:00Z'),
      end: date('2026-10-08T22:30:00Z'),
    })).toBe('Bugün 23:30–Yarın 01:30');
  });

  it("uses the city's UTC offset, not the browser timezone, for day boundaries", () => {
    expect(formatBestWindowTime({
      now: date('2026-10-08T03:00:00Z'), // 22:00, October 7 in UTC-5
      timezoneOffsetSeconds: -5 * 3600,
      language: 'en',
      todayLabel: 'Today',
      tomorrowLabel: 'Tomorrow',
      start: date('2026-10-08T12:00:00Z'),
      end: date('2026-10-08T14:00:00Z'),
    })).toBe('Tomorrow 7:00–9:00 AM');
  });

  it('uses AM/PM consistently for a window crossing midnight in English', () => {
    expect(formatBestWindowTime({
      now: date('2026-10-08T20:15:00Z'),
      timezoneOffsetSeconds: 3 * 3600,
      language: 'en',
      todayLabel: 'Today',
      tomorrowLabel: 'Tomorrow',
      start: date('2026-10-08T20:30:00Z'),
      end: date('2026-10-08T22:30:00Z'),
    })).toBe('Today 11:30 PM–Tomorrow 1:30 AM');
  });

  it('keeps late afternoon ranges readable in English', () => {
    expect(formatBestWindowTime({
      now: date('2026-10-08T12:00:00Z'),
      timezoneOffsetSeconds: 3 * 3600,
      language: 'en',
      todayLabel: 'Today',
      tomorrowLabel: 'Tomorrow',
      start: date('2026-10-08T13:00:00Z'),
      end: date('2026-10-08T15:00:00Z'),
    })).toBe('4:00–6:00 PM');
  });

  it('labels later dates explicitly when the window is beyond tomorrow', () => {
    expect(formatBestWindowTime({
      ...istanbul,
      start: date('2026-10-10T06:00:00Z'),
      end: date('2026-10-10T08:00:00Z'),
    })).toBe('10 Eki 09:00–11:00');
  });
});
