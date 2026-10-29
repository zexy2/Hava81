import type { ActivityKind, TemperatureSensitivity } from '../activity/types';
import type { WeatherTolerance } from '../plan/types';

export const ROUTINE_SCHEMA_VERSION = 1;

/** 0 = Sunday … 6 = Saturday, in the plan city's local time. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RoutineSchedule =
  | {
      /** A set time: the hour is scored, a clearly better nearby hour is suggested. */
      kind: 'fixed';
      days: Weekday[];
      /** Single date (YYYY-MM-DD, local) instead of repeating days. */
      date?: string;
      start: string;
      durationMinutes: number;
    }
  | {
      /** A time range: Hava81 finds the best window inside it. */
      kind: 'flexible';
      days: Weekday[];
      date?: string;
      from: string;
      to: string;
      durationMinutes: number;
    };

export interface RoutinePlace {
  /** Display name and coordinates; absent means "the city I am looking at". */
  name: string;
  lat: number;
  lon: number;
}

export interface Routine {
  id: string;
  name?: string;
  activity: ActivityKind;
  schedule: RoutineSchedule;
  place?: RoutinePlace;
  /** Per-plan preferences; absent fields use the general preferences. */
  sensitivity?: TemperatureSensitivity;
  windTolerance?: WeatherTolerance;
  rainTolerance?: WeatherTolerance;
  /** Reminder intent, kept for mobile and push; not delivered by the web app yet. */
  remind?: { minutesBefore: number };
  createdAt: number;
  updatedAt: number;
}

export interface RoutineOccurrence {
  /** Local date of the occurrence (YYYY-MM-DD). */
  date: string;
  startMs: number;
  endMs: number;
}
