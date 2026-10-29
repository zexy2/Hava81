/**
 * One aggregation rule for every 12-hour headline (Gün planı, activities, compare), so the same
 * hours can never produce different headline logic on different cards.
 */

import { CAUTION_MAX, DIFFICULT_MAX } from './scoreWeatherWindow';

const HOUR_MS = 60 * 60 * 1000;

export interface HorizonScoredSlot {
  time: Date;
  score: number;
}

export interface WeightedHorizonSlot<T extends HorizonScoredSlot> {
  slot: T;
  weightHours: number;
}

/** Score at or below which an hour is a hazard the headline must not hide. */
export const HAZARD_HOUR_SCORE = 25;
/** Hazard hours of this total duration turn the whole horizon into "difficult". */
const SUSTAINED_HAZARD_HOURS = 3;
const MEAN_WEIGHT = 0.78;
const DOWNSIDE_WEIGHT = 0.22;
const DOWNSIDE_FRACTION = 0.25;

const median = (values: number[]) => {
  if (!values.length) return HOUR_MS;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
};

/** Median positive spacing of a series; one hour when it cannot be inferred. */
export const forecastCadenceMs = (slots: readonly { time: Date }[]): number => {
  const ordered = [...slots].sort((a, b) => a.time.getTime() - b.time.getTime());
  return median(
    ordered
      .slice(1)
      .map((slot, index) => slot.time.getTime() - ordered[index].time.getTime())
      .filter(gap => gap > 0 && Number.isFinite(gap))
  );
};

/**
 * Drop slots whose forecast step has already ended. The slot that is in progress stays: it is
 * "now". Without `now` the series is trusted as-is (callers that know the clock must pass it).
 */
export const dropElapsedSlots = <T extends { time: Date }>(
  slots: readonly T[],
  now: Date | undefined,
  cadenceMs = forecastCadenceMs(slots)
): T[] => {
  if (!now || !Number.isFinite(now.getTime())) return [...slots];
  const nowMs = now.getTime();
  return slots.filter(slot => slot.time.getTime() + cadenceMs > nowMs);
};

/**
 * Weight each slot by the time it represents inside the horizon. A slot never stands for more
 * than one forecast step, so a gap (night hours filtered out, missing data) is not silently
 * credited to the slot before it.
 */
export const weightHorizonSlots = <T extends HorizonScoredSlot>(
  slots: readonly T[],
  horizonEndMs: number,
  cadenceMs: number,
  /** When known, the step in progress only counts for the part that is still ahead. */
  nowMs?: number
): WeightedHorizonSlot<T>[] => {
  const ordered = [...slots]
    .filter(slot => slot.time.getTime() < horizonEndMs)
    .sort((a, b) => a.time.getTime() - b.time.getTime());
  return ordered.map((slot, index) => {
    const current = slot.time.getTime();
    const next = ordered[index + 1]?.time.getTime() ?? Number.POSITIVE_INFINITY;
    const end = Math.min(next, current + cadenceMs, horizonEndMs);
    const start = Number.isFinite(nowMs) ? Math.max(current, nowMs as number) : current;
    return { slot, weightHours: Math.max(0.01, (end - start) / HOUR_MS) };
  });
};

const totalWeight = (entries: readonly WeightedHorizonSlot<HorizonScoredSlot>[]) =>
  entries.reduce((sum, entry) => sum + entry.weightHours, 0);

const weightedMean = (entries: readonly WeightedHorizonSlot<HorizonScoredSlot>[]) => {
  const total = totalWeight(entries);
  return total > 0
    ? entries.reduce((sum, entry) => sum + entry.slot.score * entry.weightHours, 0) / total
    : 0;
};

const weightedDownside = (entries: readonly WeightedHorizonSlot<HorizonScoredSlot>[]) => {
  let remaining = Math.max(0.25, totalWeight(entries) * DOWNSIDE_FRACTION);
  let sum = 0;
  let used = 0;
  for (const entry of [...entries].sort((a, b) => a.slot.score - b.slot.score)) {
    if (remaining <= 0) break;
    const weight = Math.min(entry.weightHours, remaining);
    sum += entry.slot.score * weight;
    used += weight;
    remaining -= weight;
  }
  return used > 0 ? sum / used : weightedMean(entries);
};

/**
 * Time-weighted mean blended with the worst quarter. A single hazard hour cannot make the
 * headline "good" (cap: caution) but cannot make a whole day "difficult" either; that takes a
 * sustained hazardous period.
 */
export const aggregateHorizonScore = (
  entries: readonly WeightedHorizonSlot<HorizonScoredSlot>[]
): number => {
  if (!entries.length) return 0;
  let score = Math.round(
    weightedMean(entries) * MEAN_WEIGHT + weightedDownside(entries) * DOWNSIDE_WEIGHT
  );
  const hazardHours = entries
    .filter(entry => entry.slot.score <= HAZARD_HOUR_SCORE)
    .reduce((sum, entry) => sum + entry.weightHours, 0);
  if (hazardHours >= SUSTAINED_HAZARD_HOURS) score = Math.min(score, DIFFICULT_MAX);
  else if (hazardHours > 0) score = Math.min(score, CAUTION_MAX);
  return Math.max(0, Math.min(100, score));
};

/** Rain probability band in which "will it rain?" is genuinely open. */
export const UNCERTAIN_RAIN_MIN = 0.3;
export const UNCERTAIN_RAIN_MAX = 0.7;
/** Smallest spread worth showing as "depends on the rain". */
export const MIN_SCENARIO_SPREAD = 8;

export interface ScoreRange {
  /** Headline if the uncertain showers do come. */
  low: number;
  /** Headline if they stay away. */
  high: number;
}

export const isUncertainRain = (point: { pop?: number }): boolean =>
  Number.isFinite(point.pop) &&
  (point.pop as number) >= UNCERTAIN_RAIN_MIN &&
  (point.pop as number) <= UNCERTAIN_RAIN_MAX;

/** The same hour if the shower happens (`wet`) or does not; nothing else changes. */
export const withRainScenario = <T extends { pop: number; precipitationMm?: number }>(
  point: T,
  wet: boolean
): T =>
  wet
    ? { ...point, pop: 0.9, precipitationMm: Math.max(point.precipitationMm ?? 0, 1) }
    : { ...point, pop: 0.05, precipitationMm: 0 };

/**
 * Wet / dry headline for the hours whose rain chance is genuinely open. Certain hours keep their
 * score; uncertain ones are re-scored under both outcomes with the same scorer and aggregation.
 * Returns undefined when no hour is uncertain or the outcomes barely differ.
 */
export const rainScenarioRange = <P extends { time: Date; pop: number; precipitationMm?: number }>(
  points: readonly P[],
  scoreOf: (point: P) => number,
  horizonEndMs: number,
  cadenceMs: number
): ScoreRange | undefined => {
  if (!points.some(isUncertainRain)) return undefined;
  const headline = (wet: boolean) =>
    aggregateHorizonScore(
      weightHorizonSlots(
        points.map(point => ({
          time: point.time,
          score: scoreOf(isUncertainRain(point) ? withRainScenario(point, wet) : point),
        })),
        horizonEndMs,
        cadenceMs
      )
    );
  const low = headline(true);
  const high = headline(false);
  return high - low >= MIN_SCENARIO_SPREAD ? { low, high } : undefined;
};

/**
 * How open the rain question is for an hour: 1 at a 50 % chance (or unknown), 0 at 0 % / 100 %.
 * Used only to break score ties in favour of the hour whose forecast is more decided.
 */
export const rainUncertainty = (point: { precipitationProbability?: number }): number =>
  Number.isFinite(point.precipitationProbability)
    ? 1 - Math.abs((point.precipitationProbability as number) - 0.5) * 2
    : 1;
