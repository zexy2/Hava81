import { describe, expect, it } from 'vitest';
import { evaluateRoutine } from '../../domain/routines/evaluateRoutine';
import { nextOccurrences } from '../../domain/routines/occurrences';
import type { Routine } from '../../domain/routines/types';
import {
  ROUTINES_KEY,
  loadRoutines,
  parseRoutineDocument,
  type RoutineStorageAdapter,
} from '../../storage/routineStore';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';

const OFFSET = 10800; // İstanbul, UTC+3
const HOUR_MS = 3_600_000;
// Local wall clock → UTC ms. 2026-10-29 is a Thursday.
const local = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour - 3, minute);
const NOW = local(29, 10);

const routine = (
  schedule: Routine['schedule'],
  activity: Routine['activity'] = 'run'
): Routine => ({
  id: 'r1',
  activity,
  schedule,
  createdAt: 0,
  updatedAt: 0,
});

describe('nextOccurrences', () => {
  it('weekday plan skips the weekend', () => {
    const plan = routine({
      kind: 'fixed',
      days: [1, 2, 3, 4, 5],
      start: '18:30',
      durationMinutes: 45,
    });
    const dates = nextOccurrences(plan, NOW, OFFSET, 3).map(o => o.date);
    expect(dates).toEqual(['2026-10-29', '2026-10-30', '2026-11-02']);
    expect(nextOccurrences(plan, NOW, OFFSET, 1)[0]).toMatchObject({
      startMs: local(29, 18, 30),
      endMs: local(29, 19, 15),
    });
  });

  it('a single date occurs once', () => {
    const plan = routine({
      kind: 'flexible',
      days: [],
      date: '2026-10-31',
      from: '10:00',
      to: '16:00',
      durationMinutes: 120,
    });
    expect(nextOccurrences(plan, NOW, OFFSET, 3)).toEqual([
      { date: '2026-10-31', startMs: local(31, 10), endMs: local(31, 16) },
    ]);
  });

  it('a range past midnight ends the next day; a running block is still listed', () => {
    const plan = routine({
      kind: 'flexible',
      days: [3],
      from: '22:00',
      to: '01:00',
      durationMinutes: 60,
    });
    // Wednesday 22:00 → Thursday 01:00; at Thursday 00:30 it is still running.
    expect(nextOccurrences(plan, local(29, 0, 30), OFFSET, 1)[0]).toMatchObject({
      date: '2026-10-28',
      endMs: local(29, 1),
    });
  });
});

const weather: NormalizedWeatherData = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 18,
  feelsLike: 18,
  tempMin: 14,
  tempMax: 20,
  humidity: 60,
  pressure: 1015,
  visibility: 10000,
  windSpeed: 3,
  windDirection: 40,
  description: 'açık',
  icon: '01d',
  sunrise: new Date(local(29, 7)),
  sunset: new Date(local(29, 18)),
  timestamp: new Date(NOW),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 0,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(NOW), timezoneOffsetSeconds: OFFSET },
};

/** 36 hours from 10:00; `windyFrom`–`windyTo` (local hours today) are rough. */
const hours = (windy: (hour: number) => boolean): HourlyForecast[] =>
  Array.from({ length: 36 }, (_, index) => {
    const time = new Date(NOW + index * HOUR_MS);
    const hour = (10 + index) % 24;
    const isDay = hour >= 7 && hour < 18;
    return {
      time,
      temp: 17,
      apparentTemperature: 17,
      humidity: 55,
      pop: 0.05,
      precipitationMm: 0,
      windSpeed: windy(hour) && index < 14 ? 12 : 2.5,
      windGust: windy(hour) && index < 14 ? 17 : 4,
      uvIndex: isDay ? 2 : 0,
      visibility: 20000,
      weatherCode: 1,
      icon: isDay ? '01d' : '01n',
      isDay,
      description: 'açık',
    };
  });

const input = (hourly: HourlyForecast[]) => ({
  weather,
  hourly,
  sensitivity: 'balanced' as const,
  tolerance: {},
  now: new Date(NOW),
});

describe('evaluateRoutine', () => {
  const run1830 = routine({ kind: 'fixed', days: [4], start: '18:30', durationMinutes: 45 });

  it('scores the planned block and suggests a clearly better start nearby', () => {
    const result = evaluateRoutine(run1830, input(hours(hour => hour >= 18 && hour < 20)));
    expect(result.status).toBe('scored');
    if (result.status !== 'scored') return;
    expect(result.better).toBeDefined();
    expect(result.better!.score).toBeGreaterThanOrEqual(result.plan.score + 8);
    expect(Math.abs(result.better!.startMs - local(29, 18, 30))).toBeGreaterThanOrEqual(
      HOUR_MS / 2
    );
  });

  it('does not suggest another time when the planned one is fine', () => {
    const result = evaluateRoutine(run1830, input(hours(() => false)));
    expect(result.status === 'scored' && result.better).toBeFalsy();
  });

  it('a half-hour start is scored from the hour that covers it, never empty', () => {
    const dog = routine({ kind: 'fixed', days: [5], start: '07:30', durationMinutes: 30 }, 'dog');
    const result = evaluateRoutine(dog, input(hours(() => false)));
    expect(result.status).toBe('scored');
    if (result.status !== 'scored') return;
    expect(result.plan.score).toBeGreaterThan(50);
    expect(result.plan.windowUnavailable).toBeFalsy();
  });

  it('beyond the hourly forecast there is no number yet', () => {
    const later = routine({
      kind: 'fixed',
      days: [],
      date: '2026-11-05',
      start: '18:30',
      durationMinutes: 45,
    });
    const result = evaluateRoutine(later, input(hours(() => false)));
    expect(result.status).toBe('pending');
  });
});

const memory = (
  seed: Record<string, string> = {}
): RoutineStorageAdapter & { data: Record<string, string> } => {
  const data = { ...seed };
  return { data, read: key => data[key] ?? null, write: (key, value) => void (data[key] = value) };
};

describe('routine store', () => {
  it('drops a broken plan and keeps the others', () => {
    const doc = JSON.stringify({
      schemaVersion: 1,
      routines: [
        run('a'),
        {
          ...run('b'),
          schedule: { kind: 'fixed', days: [1], start: '25:00', durationMinutes: 45 },
        },
        { ...run('c'), activity: 'skydiving' },
        run('a'),
      ],
    });
    expect(parseRoutineDocument(doc)?.map(r => r.id)).toEqual(['a']);
    expect(parseRoutineDocument('{not json')).toEqual([]);
  });

  it('turns the old selected activities into plans once', () => {
    const adapter = memory({
      'hava81-decision-profile-v1': JSON.stringify({
        activities: ['walk', 'dog', 'unknown'],
        temperatureSensitivity: 'balanced',
        activityStart: '17:00',
        activityEnd: '21:00',
      }),
    });
    const first = loadRoutines(adapter, NOW);
    expect(first.map(r => r.activity)).toEqual(['walk', 'dog']);
    expect(first[0].schedule).toMatchObject({ kind: 'flexible', from: '17:00', to: '21:00' });
    expect(adapter.data[ROUTINES_KEY]).toBeDefined();
    // Deleting every plan stays deleted: no second migration.
    adapter.write(ROUTINES_KEY, JSON.stringify({ schemaVersion: 1, routines: [] }));
    expect(loadRoutines(adapter, NOW)).toEqual([]);
  });
});

function run(id: string) {
  return {
    id,
    activity: 'run',
    schedule: { kind: 'fixed', days: [1, 3], start: '18:30', durationMinutes: 45 },
    createdAt: 1,
    updatedAt: 1,
  };
}
