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
  const peakPrecipitation = hourlyHorizonData.reduce((peak, hour) => {
    if (hour.precipitation > peak.precipitation) return hour;
    if (hour.precipitation < peak.precipitation) return peak;
    return (hour.precipitationMm ?? 0) > (peak.precipitationMm ?? 0) ? hour : peak;
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
