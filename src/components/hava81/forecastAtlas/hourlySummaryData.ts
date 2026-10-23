import { precipitationSignalSeverity } from '../../../utils/precipitation';
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
  // Keep probability and amount tied to one real hour, but rank both together.
  // A lower-probability hour with a large modeled amount can be more actionable
  // than a high-probability drizzle; use the same severity formula as other rain
  // decisions instead of letting probability always win first.
  const peakPrecipitation = hourlyHorizonData.reduce((peak, hour) =>
    precipitationSignalSeverity(hour.precipitation, hour.precipitationMm) >
    precipitationSignalSeverity(peak.precipitation, peak.precipitationMm)
      ? hour
      : peak
  );
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
