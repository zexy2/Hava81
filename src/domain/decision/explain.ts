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

  // Factors whose penalty separates the sets, strongest first.
  const candidates: Array<{ factor: Hava81ScoreFactor; gap: number; worst: ScoredWeatherWindow }> =
    [];
  for (const factor of EXPLAINABLE) {
    const goodWorst = Math.max(...good.map(slot => penaltyOf(slot, factor)));
    const worst = weak.reduce((a, b) => (penaltyOf(b, factor) > penaltyOf(a, factor) ? b : a));
    const gap = penaltyOf(worst, factor) - goodWorst;
    if (gap >= MIN_PENALTY_GAP) candidates.push({ factor, gap, worst });
  }
  candidates.sort((a, b) => b.gap - a.gap);

  // The penalty can combine inputs (rain = probability and amount), but the copy shows one
  // measurement. Only state a contrast the shown numbers actually support — never
  // "22:00 is 53 %, this window 63 %" as a reason to prefer the window.
  for (const { factor, worst } of candidates) {
    const explained = coherentContrast(factor, worst, reference);
    if (explained) return explained;
  }
  return undefined;
};

const coherentContrast = (
  factor: Hava81ScoreFactor,
  worst: ScoredWeatherWindow,
  reference: ScoredWeatherWindow
): WindowExplanation | undefined => {
  const base = { worstTime: worst.time };
  const atWorst = measured(worst, factor);
  const atWindow = measured(reference, factor);
  switch (factor) {
    case 'precipitation': {
      const probability = (slot: ScoredWeatherWindow) =>
        finite(slot.precipitationProbability)
          ? Math.round(slot.precipitationProbability * 100)
          : undefined;
      const worstP = probability(worst);
      const windowP = probability(reference);
      if (finite(worstP) && finite(windowP) && worstP > windowP)
        return { ...base, factor: 'precipitation', worstValue: worstP, windowValue: windowP };
      const worstMm = worst.precipitationMm;
      const windowMm = reference.precipitationMm;
      if (finite(worstMm) && finite(windowMm) && worstMm > windowMm)
        return { ...base, factor: 'precipitation-mm', worstValue: worstMm, windowValue: windowMm };
      return undefined;
    }
    case 'wind':
    case 'uv':
      return finite(atWorst.value) && finite(atWindow.value) && atWorst.value > atWindow.value
        ? {
            ...base,
            factor: atWorst.factor,
            worstValue: atWorst.value,
            windowValue: atWindow.value,
          }
        : undefined;
    case 'visibility':
      return finite(atWorst.value) && finite(atWindow.value) && atWorst.value < atWindow.value
        ? {
            ...base,
            factor: atWorst.factor,
            worstValue: atWorst.value,
            windowValue: atWindow.value,
          }
        : undefined;
    case 'thermal':
      // Comfort is two-sided (too cold or too hot); the values only need to differ.
      return finite(atWorst.value) && finite(atWindow.value) && atWorst.value !== atWindow.value
        ? { ...base, factor: 'thermal', worstValue: atWorst.value, windowValue: atWindow.value }
        : undefined;
    default:
      // Air quality and severe weather are named without a number.
      return { ...base, factor: atWorst.factor };
  }
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
