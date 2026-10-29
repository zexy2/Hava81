/**
 * A one-event iCalendar file (RFC 5545) for a recommended activity window. Times are UTC, so the
 * calendar shows them in the user's own zone; a 15-minute alarm reminds before the start.
 */
export interface CalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  /** Stable id so adding the same window twice updates instead of duplicating. */
  uid: string;
  now?: Date;
}

const pad = (value: number) => String(value).padStart(2, '0');

const utcStamp = (date: Date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T` +
  `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

/** TEXT values: backslash, semicolon, comma and newlines are escaped. */
const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 octets are folded with CRLF + space. */
const fold = (line: string) => {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length;
    if (size + charSize > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += charSize;
  }
  parts.push(current);
  return parts.join('\r\n ');
};

export function buildCalendarEvent({
  title,
  description,
  location,
  start,
  end,
  uid,
  now = new Date(),
}: CalendarEventInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hava81//Planla//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(title)}`,
    ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(title)}`,
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
