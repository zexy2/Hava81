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
  const offset = input.weather.meta.timezoneOffsetSeconds;
  const occurrence = nextOccurrences(routine, input.now.getTime(), offset, 1)[0];
  return occurrence ? scoreOccurrence(routine, input, occurrence) : { status: 'none' };
}

/** The plan on one local day (YYYY-MM-DD), for the day-by-day outlook; none when it does not run. */
export function evaluateRoutineOn(
  routine: Routine,
  input: RoutineWeatherInput,
  date: string
): RoutineEvaluation {
  const offset = input.weather.meta.timezoneOffsetSeconds;
  const occurrence = nextOccurrences(routine, input.now.getTime(), offset, 16).find(
    candidate => candidate.date === date
  );
  return occurrence ? scoreOccurrence(routine, input, occurrence) : { status: 'none' };
}

function scoreOccurrence(
  routine: Routine,
  input: RoutineWeatherInput,
  occurrence: RoutineOccurrence
): RoutineEvaluation {
  const { weather, hourly, now } = input;

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
  if (routine.schedule.kind === 'flexible') {
    return {
      status: 'scored',
      occurrence,
      plan: withinOccurrence(plan, occurrence, routine.schedule.durationMinutes, now.getTime()),
    };
  }

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

/**
 * Coarse forecast steps (3 h) can start before the plan: an 08:00 step overlaps a 10:00 start.
 * The answer must stay inside the plan's own hours (and after now), so the best window is
 * clipped to them and keeps at least the plan's duration when there is room for it.
 */
function withinOccurrence(
  plan: ActivityPlan,
  occurrence: RoutineOccurrence,
  durationMinutes: number,
  nowMs: number
): ActivityPlan {
  const range = plan.bestWindowRange;
  if (!range) return plan;
  // Today's window never starts in the past: a 10:00–18:00 picnic at 15:20 starts at 15:20.
  const earliestMs = Math.max(occurrence.startMs, Math.ceil(nowMs / 60_000) * 60_000);
  const startMs = Math.max(range.start.time.getTime(), earliestMs);
  const minEndMs = Math.min(startMs + durationMinutes * 60_000, occurrence.endMs);
  const endMs = Math.max(Math.min(range.endTime.getTime(), occurrence.endMs), minEndMs);
  if (startMs === range.start.time.getTime() && endMs === range.endTime.getTime()) return plan;
  return {
    ...plan,
    bestWindowRange: {
      ...range,
      start: { ...range.start, time: new Date(startMs) },
      endTime: new Date(endMs),
    },
  };
}
