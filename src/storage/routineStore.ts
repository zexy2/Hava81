import type { ActivityKind } from '../domain/activity/types';
import { ROUTINE_SCHEMA_VERSION, type Routine, type Weekday } from '../domain/routines/types';

/**
 * Where plans live. The web app uses localStorage; a mobile shell or account sync can provide
 * its own adapter without the UI changing.
 */
export interface RoutineStorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

export const localStorageAdapter: RoutineStorageAdapter = {
  read: key => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  write: (key, value) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Private mode or a full quota: the change lives until the page closes.
    }
  },
};

export const ROUTINES_KEY = 'hava81.routines.v1';
const LEGACY_PROFILE_KEY = 'hava81-decision-profile-v1';
const MAX_ROUTINES = 30;

const ACTIVITIES: readonly ActivityKind[] = [
  'walk',
  'run',
  'bike',
  'dog',
  'picnic',
  'children',
  'beach',
  'garden',
  'photo',
  'motorcycle',
  'laundry',
];
const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TOLERANCES = ['low', 'normal', 'high'];
const SENSITIVITIES = ['cold', 'balanced', 'heat'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const validDays = (value: unknown): Weekday[] | null => {
  if (!Array.isArray(value)) return null;
  const days = [...new Set(value)].filter(
    (day): day is Weekday => Number.isInteger(day) && day >= 0 && day <= 6
  );
  return days.sort();
};

/** One stored plan, or null when anything that matters is wrong. */
export function parseRoutine(value: unknown): Routine | null {
  if (!isRecord(value) || !isRecord(value.schedule)) return null;
  const { schedule } = value;
  if (typeof value.id !== 'string' || !value.id) return null;
  if (!ACTIVITIES.includes(value.activity as ActivityKind)) return null;
  const days = validDays(schedule.days);
  const date =
    typeof schedule.date === 'string' && DATE.test(schedule.date) ? schedule.date : undefined;
  if (!days || (days.length === 0 && !date)) return null;
  const duration = Number(schedule.durationMinutes);
  if (!Number.isInteger(duration) || duration < 15 || duration > 12 * 60) return null;

  let parsedSchedule: Routine['schedule'];
  if (
    schedule.kind === 'fixed' &&
    typeof schedule.start === 'string' &&
    CLOCK.test(schedule.start)
  ) {
    parsedSchedule = {
      kind: 'fixed',
      days,
      date,
      start: schedule.start,
      durationMinutes: duration,
    };
  } else if (
    schedule.kind === 'flexible' &&
    typeof schedule.from === 'string' &&
    typeof schedule.to === 'string' &&
    CLOCK.test(schedule.from) &&
    CLOCK.test(schedule.to)
  ) {
    parsedSchedule = {
      kind: 'flexible',
      days,
      date,
      from: schedule.from,
      to: schedule.to,
      durationMinutes: duration,
    };
  } else {
    return null;
  }

  const place =
    isRecord(value.place) &&
    typeof value.place.name === 'string' &&
    Number.isFinite(value.place.lat) &&
    Number.isFinite(value.place.lon) &&
    Math.abs(value.place.lat as number) <= 90 &&
    Math.abs(value.place.lon as number) <= 180
      ? { name: value.place.name, lat: value.place.lat as number, lon: value.place.lon as number }
      : undefined;
  const remindMinutes = isRecord(value.remind) ? Number(value.remind.minutesBefore) : Number.NaN;

  return {
    id: value.id,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim().slice(0, 40)
        : undefined,
    activity: value.activity as ActivityKind,
    schedule: parsedSchedule,
    place,
    sensitivity: SENSITIVITIES.includes(value.sensitivity as string)
      ? (value.sensitivity as Routine['sensitivity'])
      : undefined,
    windTolerance: TOLERANCES.includes(value.windTolerance as string)
      ? (value.windTolerance as Routine['windTolerance'])
      : undefined,
    rainTolerance: TOLERANCES.includes(value.rainTolerance as string)
      ? (value.rainTolerance as Routine['rainTolerance'])
      : undefined,
    remind:
      Number.isInteger(remindMinutes) && remindMinutes >= 0 && remindMinutes <= 24 * 60
        ? { minutesBefore: remindMinutes }
        : undefined,
    createdAt: Number.isFinite(value.createdAt) ? (value.createdAt as number) : 0,
    updatedAt: Number.isFinite(value.updatedAt) ? (value.updatedAt as number) : 0,
  };
}

/** Plans from a stored or imported document; bad entries are dropped, not the whole list. */
export function parseRoutineDocument(raw: string | null): Routine[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.routines)) return [];
    const seen = new Set<string>();
    return parsed.routines
      .map(parseRoutine)
      .filter((routine): routine is Routine => {
        if (!routine || seen.has(routine.id)) return false;
        seen.add(routine.id);
        return true;
      })
      .slice(0, MAX_ROUTINES);
  } catch {
    return [];
  }
}

export const serializeRoutines = (routines: readonly Routine[]) =>
  JSON.stringify({
    schemaVersion: ROUTINE_SCHEMA_VERSION,
    routines: routines.slice(0, MAX_ROUTINES),
  });

export const newRoutineId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * First run after the update: the activities someone had selected become flexible daily plans,
 * using their saved clock range when they had one. Nobody loses what they set up.
 */
export function migrateLegacyProfile(adapter: RoutineStorageAdapter, nowMs: number): Routine[] {
  try {
    const legacy: unknown = JSON.parse(adapter.read(LEGACY_PROFILE_KEY) ?? 'null');
    if (!isRecord(legacy) || !Array.isArray(legacy.activities)) return [];
    const from =
      typeof legacy.activityStart === 'string' && CLOCK.test(legacy.activityStart)
        ? legacy.activityStart
        : '07:00';
    const to =
      typeof legacy.activityEnd === 'string' && CLOCK.test(legacy.activityEnd)
        ? legacy.activityEnd
        : '22:00';
    return [...new Set(legacy.activities)]
      .filter((activity): activity is ActivityKind => ACTIVITIES.includes(activity as ActivityKind))
      .map(activity => ({
        id: newRoutineId(),
        activity,
        schedule: { kind: 'flexible' as const, days: EVERY_DAY, from, to, durationMinutes: 60 },
        createdAt: nowMs,
        updatedAt: nowMs,
      }));
  } catch {
    return [];
  }
}

export function loadRoutines(
  adapter: RoutineStorageAdapter = localStorageAdapter,
  nowMs = Date.now()
) {
  const stored = parseRoutineDocument(adapter.read(ROUTINES_KEY));
  if (stored !== null) return stored;
  const migrated = migrateLegacyProfile(adapter, nowMs);
  adapter.write(ROUTINES_KEY, serializeRoutines(migrated));
  return migrated;
}

export function saveRoutines(
  routines: readonly Routine[],
  adapter: RoutineStorageAdapter = localStorageAdapter
) {
  adapter.write(ROUTINES_KEY, serializeRoutines(routines));
}
