import type { PlanConfidence } from './types';

const confidenceRank: Readonly<Record<PlanConfidence, number>> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Forecast confidence is deliberately conservative: every slot at or beyond 72 hours is low
 * confidence, even when all modeled fields are present. Missing inputs reduce confidence without
 * inventing values or automatically turning an unavailable signal into a weather penalty.
 */
export const getPlanConfidence = (
  forecastHoursAhead: number,
  dataCoverage: number
): PlanConfidence => {
  if (!Number.isFinite(forecastHoursAhead) || forecastHoursAhead >= 72) return 'low';
  if (!Number.isFinite(dataCoverage) || dataCoverage < 0.45) return 'low';
  if (forecastHoursAhead > 24 || dataCoverage < 0.75) return 'medium';
  return 'high';
};

export const worstPlanConfidence = (...values: PlanConfidence[]): PlanConfidence =>
  values.reduce<PlanConfidence>(
    (worst, value) => (confidenceRank[value] > confidenceRank[worst] ? value : worst),
    'high'
  );
