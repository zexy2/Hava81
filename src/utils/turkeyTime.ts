const TURKEY_TIME_ZONE = 'Europe/Istanbul';

const inputFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TURKEY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const partsFor = (date: Date) =>
  Object.fromEntries(
    inputFormatter
      .formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  ) as Record<string, string>;

const offsetAt = (date: Date): number => {
  const parts = partsFor(date);
  const representedUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return representedUtc - Math.floor(date.getTime() / 1000) * 1000;
};

export const toTurkeyLocalInputValue = (date: Date): string => {
  const parts = partsFor(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

export const parseTurkeyLocalInputValue = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const wallClockAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
  if (!Number.isFinite(wallClockAsUtc)) return null;

  let candidate = new Date(wallClockAsUtc);
  for (let iteration = 0; iteration < 2; iteration += 1) {
    candidate = new Date(wallClockAsUtc - offsetAt(candidate));
  }

  return toTurkeyLocalInputValue(candidate) === value ? candidate : null;
};

export const formatTurkeyTime = (date: Date, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone: TURKEY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
