import type { Routine, RoutineOccurrence, Weekday } from './types';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const clockMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const localDateKey = (localMidnightMs: number) =>
  new Date(localMidnightMs).toISOString().slice(0, 10);

/**
 * The next occurrences of a plan that have not ended yet, in the city's local time. A block that
 * ends before it starts on the clock (22:00 for 3 hours) runs into the next day.
 */
export function nextOccurrences(
  routine: Routine,
  nowMs: number,
  timezoneOffsetSeconds: number,
  count = 3,
  horizonDays = 14
): RoutineOccurrence[] {
  const offsetMs = timezoneOffsetSeconds * 1000;
  const schedule = routine.schedule;
  const startMinutes = clockMinutes(schedule.kind === 'fixed' ? schedule.start : schedule.from);
  if (startMinutes === null) return [];
  let spanMinutes: number;
  if (schedule.kind === 'fixed') {
    spanMinutes = schedule.durationMinutes;
  } else {
    const endMinutes = clockMinutes(schedule.to);
    if (endMinutes === null) return [];
    spanMinutes = (endMinutes - startMinutes + 24 * 60) % (24 * 60) || 24 * 60;
  }
  if (!(spanMinutes > 0)) return [];

  const todayLocalMidnight = Math.floor((nowMs + offsetMs) / DAY_MS) * DAY_MS;
  const out: RoutineOccurrence[] = [];
  // Start one day back so a block that began yesterday and is still running is included.
  for (let day = -1; day <= horizonDays && out.length < count; day += 1) {
    const localMidnight = todayLocalMidnight + day * DAY_MS;
    const date = localDateKey(localMidnight);
    const weekday = new Date(localMidnight).getUTCDay() as Weekday;
    const matches = schedule.date ? schedule.date === date : schedule.days.includes(weekday);
    if (!matches) continue;
    const startMs = localMidnight + startMinutes * MINUTE_MS - offsetMs;
    const endMs = startMs + spanMinutes * MINUTE_MS;
    if (endMs <= nowMs) continue;
    out.push({ date, startMs, endMs });
  }
  return out;
}
