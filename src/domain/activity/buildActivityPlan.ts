import type {
  AirQuality,
  AirQualityHourly,
  ContextSignals,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { getOptionalEvidenceFreshness } from '../../utils/optionalEvidenceFreshness';
import {
  aggregateHorizonScore,
  dropElapsedSlots,
  forecastCadenceMs,
  rainScenarioRange,
  rainUncertainty,
  weightHorizonSlots,
} from '../decision/aggregateHorizon';
import { getDailyPlanAirQualityEvidence } from '../decision/airQualityEvidence';
import { findBestWindowRange } from '../decision/bestWindowRange';
import { explainWindow } from '../decision/explain';
import { getScoreBand } from '../decision/scoreWeatherWindow';
import type { DecisionReasonCode, Hava81ScoreFactor, ScoreFactorImpact } from '../decision/types';
import { findWindows } from '../plan/findWindows';
import { PLAN_PROFILES } from '../plan/profiles';
import { scoreHour } from '../plan/scoreHour';
import type {
  PersonalTolerance,
  PlanGateReason,
  PlanHourScore,
  PlanPenalties,
  PlanWindow,
} from '../plan/types';
import type { BestWindowRange } from '../decision/types';
import type {
  ActivityKind,
  ActivityPlan,
  ActivityWindowScore,
  TemperatureSensitivity,
} from './types';

const HOUR_MS = 60 * 60 * 1000;
const HORIZON_HOURS = 12;
/** Gates about the time of day, not the weather. */
const TIME_GATES: ReadonlySet<PlanGateReason> = new Set<PlanGateReason>([
  'daylight-required',
  'outside-active-hours',
]);

/** Comfort ranges shown in the UI; the plan profiles are the single source. */
export const ACTIVITY_COMFORT_RANGES_C: Partial<Record<ActivityKind, readonly [number, number]>> = {
  walk: PLAN_PROFILES.walk.comfortRangeC,
  run: PLAN_PROFILES.run.comfortRangeC,
  picnic: PLAN_PROFILES.picnic.comfortRangeC,
  children: PLAN_PROFILES.children.comfortRangeC,
};

export interface BuildActivityPlanInput {
  activity: ActivityKind;
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  /** Fresh Open-Meteo European AQI samples; only exact matching hours are used. */
  airQualityHourly?: AirQualityHourly;
  sensitivity?: TemperatureSensitivity;
  preferredStart?: string;
  preferredEnd?: string;
  /** Clock used to drop forecast steps that already ended. UI callers pass the live clock. */
  now?: Date;
  /** Context signals (Open-Meteo); the fresh 24-hour dust and pollen peaks are used. */
  contextSignals?: ContextSignals | null;
  /** Personal wind / rain tolerance and pollen allergy. */
  tolerance?: PersonalTolerance;
}

/** Context peaks cover the 24 hours after the fetch; outside that, or stale, they are unknown. */
const contextPeakForSlot = (
  signals: ContextSignals | null | undefined,
  value: number | undefined,
  time: Date,
  nowMs: number
) => {
  if (!signals || !Number.isFinite(value)) return undefined;
  if (!getOptionalEvidenceFreshness(signals, nowMs).fresh) return undefined;
  const fetchedMs = signals.fetchedAt.getTime();
  const slotMs = time.getTime();
  return slotMs >= fetchedMs - HOUR_MS && slotMs < fetchedMs + 24 * HOUR_MS ? value : undefined;
};

/** The worse of the two seasonal pollens Open-Meteo reports for Türkiye (grass, olive). */
const pollenPeak = (signals: ContextSignals | null | undefined) => {
  const values = [signals?.grassPollenMax, signals?.olivePollenMax].filter(
    (value): value is number => Number.isFinite(value)
  );
  return values.length ? Math.max(...values) : undefined;
};

const parseClockMinutes = (clock?: string): number | null => {
  if (!clock) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const localClockMinutes = (date: Date, timezoneOffsetSeconds: number) => {
  const local = new Date(date.getTime() + timezoneOffsetSeconds * 1000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
};

/** Start inclusive, end exclusive (09:00–12:00 ends before the 12:00 slot), like plan windows. */
const clockInRange = (value: number, start: number, end: number) => {
  if (start === end) return value === start;
  return start < end ? value >= start && value < end : value >= start || value < end;
};

const impactFactors: ReadonlyArray<[keyof PlanPenalties, Hava81ScoreFactor]> = [
  ['thermal', 'thermal'],
  ['precipitation', 'precipitation'],
  ['wind', 'wind'],
  ['airQuality', 'air-quality'],
  ['uv', 'uv'],
  ['visibility', 'visibility'],
  ['severeWeather', 'severe-weather'],
  ['compound', 'compound'],
];

const toImpacts = (penalties: PlanPenalties): ScoreFactorImpact[] =>
  impactFactors
    .map(([key, factor]) => ({
      factor,
      // Intent-only effects are shown with the family they belong to: drying power with
      // moisture, mugginess with thermal comfort, dust and pollen with air quality.
      penalty:
        penalties[key] +
        (key === 'precipitation' ? penalties.drying : 0) +
        (key === 'thermal' ? penalties.muggy : 0) +
        (key === 'airQuality' ? penalties.dust + penalties.pollen : 0),
    }))
    .filter(impact => impact.penalty >= 0.5)
    .sort((a, b) => b.penalty - a.penalty);

const toActivitySlot = (activity: ActivityKind, hour: PlanHourScore): ActivityWindowScore => ({
  time: hour.time,
  score: hour.score,
  band: hour.band,
  temperature: hour.temperature,
  apparentTemperature: hour.apparentTemperature,
  precipitationProbability: hour.precipitationProbability,
  precipitationMm: hour.precipitationMm,
  windSpeed: hour.windSpeed,
  windGust: hour.windGust,
  humidity: hour.humidity,
  uvIndex: hour.uvIndex,
  visibility: hour.visibility,
  weatherCode: hour.weatherCode,
  reasons: hour.reasons,
  impacts: toImpacts(hour.penalties),
  activity,
  baselineScore: hour.baseScore,
  activityReasons: hour.reasons.filter(reason => !hour.baseReasons.includes(reason)),
  eligible: hour.eligible,
  gateReasons: hour.gateReasons,
});

/**
 * Activity plan on the single intent scorer (`plan/scoreHour`): one weighting model, one set of
 * gates (daylight, active hours, rain/wind limits, safety), and the same 12-hour aggregation as
 * the day plan.
 */
export const buildActivityPlan = ({
  activity,
  weather,
  hourly,
  airQuality,
  airQualityHourly,
  sensitivity = 'balanced',
  preferredStart,
  preferredEnd,
  now,
  contextSignals,
  tolerance,
}: BuildActivityPlanInput): ActivityPlan => {
  const valid = [...hourly]
    .filter(point => point.time instanceof Date && Number.isFinite(point.time.getTime()))
    .sort((a, b) => a.time.getTime() - b.time.getTime());
  const source = dropElapsedSlots(valid, now).slice(0, 48);
  // Without hourly data only the current observation remains; rain stays unknown on purpose.
  const points: HourlyForecast[] = source.length
    ? source
    : [
        {
          time: weather.timestamp,
          temp: weather.temperature,
          apparentTemperature: weather.feelsLike,
          humidity: weather.humidity,
          pop: Number.NaN,
          windSpeed: weather.windSpeed,
          visibility: weather.visibility,
          icon: weather.icon,
          description: weather.description,
        },
      ];

  // Prefer fresh, exact-hour European AQI. Never interpolate between AQI timestamps; when a
  // matching hourly sample is unavailable, keep the fresh current-reading fallback. Laundry
  // gives air quality zero weight in its profile.
  const airQualityEvidence = getDailyPlanAirQualityEvidence({
    forecastTimes: points.map(point => point.time),
    airQuality,
    airQualityHourly,
    now: now?.getTime(),
  });
  const scoringNow = now ?? new Date();
  const timezoneOffsetSeconds = weather.meta.timezoneOffsetSeconds;
  const scorePoint = (point: HourlyForecast) =>
    scoreHour({
      intent: activity,
      point,
      timezoneOffsetSeconds,
      now: scoringNow,
      airQualityIndexOverride:
        airQualityEvidence.hourlyAqiByTime.get(point.time.getTime()) ??
        airQualityEvidence.currentAirQuality?.aqi,
      sensitivity,
      dustUgM3: contextPeakForSlot(
        contextSignals,
        contextSignals?.dustMax,
        point.time,
        scoringNow.getTime()
      ),
      pollenGrainsM3: contextPeakForSlot(
        contextSignals,
        pollenPeak(contextSignals),
        point.time,
        scoringNow.getTime()
      ),
      tolerance,
    });
  const hourScores = points.map(scorePoint);
  const slots = hourScores.map(hour => toActivitySlot(activity, hour));
  const slotByHour = new Map<PlanHourScore, ActivityWindowScore>(
    hourScores.map((hour, index) => [hour, slots[index]])
  );
  const hourBySlot = new Map<ActivityWindowScore, PlanHourScore>(
    hourScores.map((hour, index) => [slots[index], hour])
  );

  const startMinutes = parseClockMinutes(preferredStart);
  const endMinutes = parseClockMinutes(preferredEnd);
  const windowApplied =
    startMinutes !== null && endMinutes !== null && preferredStart && preferredEnd
      ? { start: preferredStart, end: preferredEnd }
      : undefined;

  const firstMs = slots[0].time.getTime();
  const horizonHours = windowApplied ? 24 : HORIZON_HOURS;
  const horizonEndMs = firstMs + horizonHours * HOUR_MS;
  const evaluatedSlots = slots.filter(
    slot =>
      slot.time.getTime() < horizonEndMs &&
      (!windowApplied ||
        clockInRange(
          localClockMinutes(slot.time, timezoneOffsetSeconds),
          startMinutes!,
          endMinutes!
        ))
  );

  // Plan v3 Faz 0.3 + intent gates: dark hours never become the best picnic/children/laundry
  // time, walk/run only consider 07–23 local, and unknown rain never becomes a laundry window.
  // Every hour is still scored and shown on the timeline.
  const isEligible = (slot: ActivityWindowScore) => slot.eligible === true;
  // Without a user-selected clock range, an evening search whose next 12 hours are all
  // ineligible (e.g. a winter picnic after sunset) looks at the next 24 hours instead of
  // showing no window at all.
  const nextDayEndMs = firstMs + 24 * HOUR_MS;
  const candidateSlots =
    !windowApplied && !evaluatedSlots.some(isEligible)
      ? slots.filter(slot => slot.time.getTime() < nextDayEndMs)
      : evaluatedSlots;
  // A plan needs the whole activity, not one good clock tick: choose the best block in which
  // every slot of the activity's duration is recommendable (a 2-hour picnic needs 2 dry hours).
  // Sparse three-hourly data cannot prove a continuous block; it keeps the near-best range.
  const durationMinutes = PLAN_PROFILES[activity].durationMinutes;
  // A selected single instant ("18:00–18:00") asks about that moment, not a block.
  const instantWindow = Boolean(windowApplied && startMinutes === endMinutes);
  const blocksIn = (pool: ActivityWindowScore[]) =>
    instantWindow
      ? []
      : findWindows(
          pool.map(slot => hourBySlot.get(slot)!),
          {
            durationMinutes,
            timezoneOffsetSeconds,
            availability: windowApplied
              ? { startTime: windowApplied.start, endTime: windowApplied.end }
              : undefined,
          }
        );
  // No full block in the next 12 hours (a 21:00 picnic with one bright hour before 09:00):
  // the honest next answer is tomorrow's block, not "nothing".
  let windowPool = candidateSlots;
  let windows = blocksIn(windowPool);
  if (!windows.length && !windowApplied) {
    windowPool = slots.filter(slot => slot.time.getTime() < nextDayEndMs);
    windows = blocksIn(windowPool);
  }
  const meanUncertainty = (window: PlanWindow) =>
    window.slots.reduce((sum, slot) => sum + rainUncertainty(slot), 0) / window.slots.length;
  // Equal scores: the more decided forecast first, then the earlier window.
  const ranked = [...windows].sort(
    (a, b) =>
      b.score - a.score ||
      meanUncertainty(a) - meanUncertainty(b) ||
      a.start.getTime() - b.start.getTime()
  );
  const toRange = (window: PlanWindow): BestWindowRange<ActivityWindowScore> => ({
    start: slotByHour.get(window.slots[0])!,
    end: slotByHour.get(window.slots[window.slots.length - 1])!,
    endTime: window.end,
    peak: slotByHour.get(window.peak)!,
    tolerance: 0,
  });
  // With hourly data, "no block fits the whole activity" is the honest answer; a shorter range
  // would promise a 2-hour picnic in a 1-hour gap.
  const hourlyCadence =
    !instantWindow && forecastCadenceMs(slots) <= 1.5 * HOUR_MS && slots.length > 1;
  const bestWindowRange = ranked.length
    ? toRange(ranked[0])
    : hourlyCadence
      ? undefined
      : findBestWindowRange(candidateSlots, undefined, isEligible);
  const alternativeWindows = ranked.slice(1, 3).map(toRange);
  const bestWindow = bestWindowRange?.peak;

  // Same rule as the day plan: the headline reads the hours of day this activity can use
  // (daylight / active hours). Weather gates must stay in: a storm hour is not recommendable,
  // but hiding it from the score would make a stormy day look perfect.
  const usableTime = (slot: ActivityWindowScore) =>
    !slot.gateReasons?.some(reason => TIME_GATES.has(reason));
  const usableEvaluated = evaluatedSlots.filter(usableTime);
  const scoringSlots = usableEvaluated.length ? usableEvaluated : evaluatedSlots;
  const cadenceMs = forecastCadenceMs(slots);
  const rawScore = aggregateHorizonScore(weightHorizonSlots(scoringSlots, horizonEndMs, cadenceMs));
  const pointOf = new Map(slots.map((slot, index) => [slot, points[index]]));
  const scoreRange = rainScenarioRange(
    scoringSlots.map(slot => pointOf.get(slot)!),
    point => scorePoint(point).score,
    horizonEndMs,
    cadenceMs
  );
  const baselineScore = aggregateHorizonScore(
    weightHorizonSlots(
      scoringSlots.map(slot => ({ time: slot.time, score: slot.baselineScore })),
      horizonEndMs,
      cadenceMs
    )
  );
  // Compare against the hours of day the activity could use in the same search window.
  const explanation = bestWindowRange
    ? explainWindow(bestWindowRange, windowPool.filter(usableTime))
    : undefined;
  const reasonCounts = new Map<DecisionReasonCode, number>();
  scoringSlots.forEach(slot =>
    slot.reasons.forEach(reason => reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1))
  );
  const reasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason]) => reason);
  const score = reasons.length > 0 ? Math.min(rawScore, 96) : rawScore;

  return {
    activity,
    score,
    baselineScore,
    activityImpact: score - baselineScore,
    band: getScoreBand(score),
    bestWindow,
    bestWindowRange,
    bestWindowScore: ranked[0]?.score,
    alternativeWindows,
    durationMinutes,
    explanation,
    scoreRange,
    slots,
    reasons,
    windowApplied,
    windowUnavailable: Boolean(windowApplied && evaluatedSlots.length === 0),
  };
};
