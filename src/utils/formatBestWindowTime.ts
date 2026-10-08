interface BestWindowTimeOptions {
  start: Date;
  end: Date;
  now: Date;
  timezoneOffsetSeconds: number;
  language: string;
  todayLabel: string;
  tomorrowLabel: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Communicate which *local calendar day* a recommended forecast window uses.
 * The browser's timezone must not change a Turkish city's day labels.
 */
export function formatBestWindowTime({
  start,
  end,
  now,
  timezoneOffsetSeconds,
  language,
  todayLabel,
  tomorrowLabel,
}: BestWindowTimeOptions): string {
  const locale = language.startsWith('en') ? 'en-GB' : 'tr-TR';
  const offsetMs = timezoneOffsetSeconds * 1000;
  const local = (date: Date) => new Date(date.getTime() + offsetMs);
  const dayKey = (date: Date) => local(date).toISOString().slice(0, 10);
  const todayKey = dayKey(now);
  const tomorrowKey = new Date(Date.parse(`${todayKey}T00:00:00.000Z`) + DAY_MS)
    .toISOString()
    .slice(0, 10);
  // Other English hourly cards display 12-hour clocks (e.g. 11 PM).
  // Use the same clock here while preserving tr-TR's 24-hour format and
  // the en-GB style already used for explicit calendar dates.
  const english = language.startsWith('en');
  const timeFormatter = new Intl.DateTimeFormat(english ? 'en-US' : 'tr-TR', {
    hour: english ? 'numeric' : '2-digit',
    minute: '2-digit',
    hour12: english,
    timeZone: 'UTC',
  });
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const clock = (date: Date) => timeFormatter.format(local(date));
  const prefix = (date: Date) => {
    const key = dayKey(date);
    if (key === todayKey) return todayLabel;
    if (key === tomorrowKey) return tomorrowLabel;
    return dateFormatter.format(local(date));
  };

  const startTime = clock(start);
  const endTime = clock(end);
  const sameInstant = start.getTime() === end.getTime();
  const sameLocalDay = dayKey(start) === dayKey(end);
  const startsToday = dayKey(start) === todayKey;
  // Repeating AM/PM needlessly wraps the narrow hero chip. Omit it from the
  // first clock only when both endpoints share the same local day and period.
  const samePeriod = english && sameLocalDay &&
    timeFormatter.formatToParts(local(start)).find(part => part.type === 'dayPeriod')?.value ===
      timeFormatter.formatToParts(local(end)).find(part => part.type === 'dayPeriod')?.value;
  const conciseStart = samePeriod ? startTime.replace(/\s*(?:AM|PM)$/, '') : startTime;

  if (sameInstant) return startsToday ? startTime : `${prefix(start)} ${startTime}`;
  if (sameLocalDay) {
    const timeRange = `${conciseStart}–${endTime}`;
    return startsToday ? timeRange : `${prefix(start)} ${timeRange}`;
  }
  return `${prefix(start)} ${startTime}–${prefix(end)} ${endTime}`;
}
