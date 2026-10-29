import type { HourlyDatum } from './types';

export interface HourlySummaryData {
  min: number;
  max: number;
  minHour: HourlyDatum | null;
  maxHour: HourlyDatum | null;
  peakPrecipitation: HourlyDatum;
}

/** Low / high / rain figures for the hourly horizon, each anchored to a time. */
export const buildHourlySummary = (
  hourlyHorizonData: readonly HourlyDatum[]
): HourlySummaryData | null => {
  if (hourlyHorizonData.length === 0) return null;
  // Keep probability and amount tied to one real hour. The peak is the hour with
  // the highest probability (ties broken by larger modeled amount); when no hour
  // carries a probability, fall back to the hour with the largest amount.
  const hasRainEvidence = (hour: HourlyDatum) =>
    (typeof hour.precipitation === 'number' &&
      Number.isFinite(hour.precipitation) &&
      hour.precipitation >= 0 &&
      hour.precipitation <= 1) ||
    (typeof hour.precipitationMm === 'number' &&
      Number.isFinite(hour.precipitationMm) &&
      hour.precipitationMm >= 0);
  const evidenceHours = hourlyHorizonData.filter(hasRainEvidence);
  const candidates = evidenceHours.length > 0 ? evidenceHours : hourlyHorizonData;
  const prob = (hour: HourlyDatum) =>
    Number.isFinite(hour.precipitation)
      ? Math.min(1, Math.max(0, hour.precipitation as number))
      : 0;
  const mm = (hour: HourlyDatum) =>
    Number.isFinite(hour.precipitationMm) ? Math.max(0, hour.precipitationMm as number) : 0;
  const peakPrecipitation = candidates.reduce((peak, hour) => {
    if (prob(hour) !== prob(peak)) return prob(hour) > prob(peak) ? hour : peak;
    return mm(hour) > mm(peak) ? hour : peak;
  });
  const min = Math.min(...hourlyHorizonData.map(hour => hour.convertedTemp));
  const max = Math.max(...hourlyHorizonData.map(hour => hour.convertedTemp));
  return {
    min,
    max,
    // The first hour reaching each extreme anchors the stat to a time.
    minHour: hourlyHorizonData.find(hour => hour.convertedTemp === min) ?? null,
    maxHour: hourlyHorizonData.find(hour => hour.convertedTemp === max) ?? null,
    peakPrecipitation,
  };
};
