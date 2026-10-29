import type {
  AirQuality,
  AirQualityHourly,
  ContextSignals,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { buildActivityPlan } from '../activity/buildActivityPlan';
import type { ActivityPlan, TemperatureSensitivity } from '../activity/types';
import type { PersonalTolerance } from '../plan/types';
import { nextOccurrences } from './occurrences';
import type { Routine, RoutineOccurrence } from './types';

const HOUR_MS = 3_600_000;
/** A fixed plan looks this far either side for a better start. */
const ALTERNATIVE_REACH_MS = 2 * HOUR_MS;
/** A nearby hour must beat the planned one by this much to be suggested. */
const BETTER_BY = 8;

export interface RoutineWeatherInput {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  airQualityHourly?: AirQualityHourly;
  contextSignals?: ContextSignals | null;
  /** General preferences; the plan's own fields override them. */
  sensitivity: TemperatureSensitivity;
  tolerance: PersonalTolerance;
  now: Date;
}

export type RoutineEvaluation =
  | {
      status: 'scored';
      occurrence: RoutineOccurrence;
      plan: ActivityPlan;
      /** Fixed plans: a clearly better start nearby. */
      better?: { startMs: number; endMs: number; score: number };
    }
  /** The occurrence is beyond the hourly forecast: no number yet. */
  | { status: 'pending'; occurrence: RoutineOccurrence; daysUntilForecast: number }
  | { status: 'none' };

export function evaluateRoutine(routine: Routine, input: RoutineWeatherInput): RoutineEvaluation {
  const { weather, hourly, now } = input;
  const offset = weather.meta.timezoneOffsetSeconds;
  const occurrences = nextOccurrences(routine, now.getTime(), offset, 1);
  const occurrence = occurrences[0];
  if (!occurrence) return { status: 'none' };

  const lastHourMs = hourly.reduce(
    (latest, point) => Math.max(latest, point.time.getTime() + HOUR_MS),
    Number.NEGATIVE_INFINITY
  );
  if (!Number.isFinite(lastHourMs) || occurrence.startMs >= lastHourMs) {
    return {
      status: 'pending',
      occurrence,
      daysUntilForecast: Math.max(
        1,
        Math.ceil((occurrence.startMs - Math.max(lastHourMs, now.getTime())) / (24 * HOUR_MS))
      ),
    };
  }

  const planIn = (startMs: number, endMs: number) =>
    buildActivityPlan({
      activity: routine.activity,
      weather,
      hourly,
      airQuality: input.airQuality,
      airQualityHourly: input.airQualityHourly,
      sensitivity: routine.sensitivity ?? input.sensitivity,
      now,
      contextSignals: input.contextSignals,
      tolerance: {
        ...input.tolerance,
        wind: routine.windTolerance ?? input.tolerance.wind,
        rain: routine.rainTolerance ?? input.tolerance.rain,
      },
      period: { startMs: Math.max(startMs, now.getTime()), endMs },
    });

  const plan = planIn(occurrence.startMs, occurrence.endMs);
  if (routine.schedule.kind === 'flexible') return { status: 'scored', occurrence, plan };

  const wider = planIn(
    occurrence.startMs - ALTERNATIVE_REACH_MS,
    occurrence.endMs + ALTERNATIVE_REACH_MS
  );
  const range = wider.windowUnavailable ? undefined : wider.bestWindowRange;
  const startsElsewhere =
    range && Math.abs(range.start.time.getTime() - occurrence.startMs) >= HOUR_MS / 2;
  const better =
    range && startsElsewhere && wider.score >= plan.score + BETTER_BY
      ? { startMs: range.start.time.getTime(), endMs: range.endTime.getTime(), score: wider.score }
      : undefined;
  return { status: 'scored', occurrence, plan, better };
}
