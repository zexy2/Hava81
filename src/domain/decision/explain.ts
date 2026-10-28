import type { Hava81ScoreFactor, ScoredWeatherWindow } from './types';

/**
 * "Why this window?" — the factor that separates the recommended window from the other usable
 * hours, with the measured values on both sides. Built only from evidence the scorer used:
 * no factor is named unless its penalty actually differs, and no value is invented.
 */
export type ExplainedFactor =
  | 'thermal'
  | 'precipitation'
  | 'precipitation-mm'
  | 'wind'
  | 'uv'
  | 'visibility'
  | 'air-quality'
  | 'severe-weather';

export interface WindowExplanation {
  factor: ExplainedFactor;
  /** The usable hour outside the window where this factor hurts most. */
  worstTime: Date;
  /** Measured value at `worstTime` (°C, %, mm, m/s, UV index, km); absent for AQI/severe. */
  worstValue?: number;
  /** The same measurement at the window's peak slot. */
  windowValue?: number;
}

/** Penalty gap below which the window is not meaningfully better on any single factor. */
const MIN_PENALTY_GAP = 6;

const EXPLAINABLE: readonly Hava81ScoreFactor[] = [
  'thermal',
  'precipitation',
  'wind',
  'uv',
  'visibility',
  'air-quality',
  'severe-weather',
];

const penaltyOf = (slot: ScoredWeatherWindow, factor: Hava81ScoreFactor) =>
  slot.impacts.find(impact => impact.factor === factor)?.penalty ?? 0;

const finite = (value: number | undefined): value is number => Number.isFinite(value);

const measured = (
  slot: ScoredWeatherWindow,
  factor: Hava81ScoreFactor
): { factor: ExplainedFactor; value?: number } => {
  switch (factor) {
    case 'thermal':
      return { factor, value: Math.round(slot.apparentTemperature) };
    case 'precipitation':
      return finite(slot.precipitationProbability)
        ? { factor, value: Math.round(slot.precipitationProbability * 100) }
        : { factor: 'precipitation-mm', value: slot.precipitationMm };
    case 'wind':
      return {
        factor,
        value: finite(slot.windGust) ? Math.max(slot.windGust, slot.windSpeed) : slot.windSpeed,
      };
    case 'uv':
      return { factor, value: finite(slot.uvIndex) ? Math.round(slot.uvIndex) : undefined };
    case 'visibility':
      return {
        factor,
        value: finite(slot.visibility) ? Math.round(slot.visibility / 100) / 10 : undefined,
      };
    case 'air-quality':
      return { factor: 'air-quality' };
    default:
      return { factor: 'severe-weather' };
  }
};

/**
 * The factor that separates a good set of hours from a weaker set, with values at the weakest
 * hour and at `reference` (a good hour). Used both for "why this window" and, on an even day,
 * for "why these hours are weaker".
 */
export const explainContrast = (
  good: readonly ScoredWeatherWindow[],
  weak: readonly ScoredWeatherWindow[],
  reference: ScoredWeatherWindow
): WindowExplanation | undefined => {
  if (!good.length || !weak.length) return undefined;

  let best: { factor: Hava81ScoreFactor; gap: number; worst: ScoredWeatherWindow } | undefined;
  for (const factor of EXPLAINABLE) {
    const goodWorst = Math.max(...good.map(slot => penaltyOf(slot, factor)));
    const worst = weak.reduce((a, b) => (penaltyOf(b, factor) > penaltyOf(a, factor) ? b : a));
    const gap = penaltyOf(worst, factor) - goodWorst;
    if (gap >= MIN_PENALTY_GAP && (!best || gap > best.gap)) best = { factor, gap, worst };
  }
  if (!best) return undefined;

  const atWorst = measured(best.worst, best.factor);
  const atWindow = measured(reference, best.factor);
  // Precipitation is described in one unit on both sides; fall back to mm only when the
  // probability is unknown for either slot.
  const sameUnit = atWorst.factor === atWindow.factor;
  const factor = sameUnit ? atWorst.factor : 'precipitation-mm';
  return {
    factor,
    worstTime: best.worst.time,
    worstValue: sameUnit ? atWorst.value : best.worst.precipitationMm,
    windowValue: sameUnit ? atWindow.value : reference.precipitationMm,
  };
};

export const explainWindow = (
  window: { start: ScoredWeatherWindow; endTime: Date; peak: ScoredWeatherWindow },
  usableSlots: readonly ScoredWeatherWindow[]
): WindowExplanation | undefined => {
  const startMs = window.start.time.getTime();
  const endMs = window.endTime.getTime();
  const inside = usableSlots.filter(
    slot => slot.time.getTime() >= startMs && slot.time.getTime() < endMs
  );
  const outside = usableSlots.filter(
    slot => slot.time.getTime() < startMs || slot.time.getTime() >= endMs
  );
  return explainContrast(inside, outside, window.peak);
};
