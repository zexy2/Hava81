import type { AirQuality, AirQualityHourly } from '../../types';
import { europeanAqiToOpenWeatherIndex } from '../../utils/airQuality';
import { getOptionalEvidenceFreshness } from '../../utils/optionalEvidenceFreshness';

export interface DailyPlanAirQualityEvidenceInput {
  forecastTimes: readonly Date[];
  airQuality?: AirQuality;
  airQualityHourly?: AirQualityHourly;
  now?: number;
}

export interface DailyPlanAirQualityEvidence {
  /** Current OpenWeather reading, only when fresh and within its documented 1–5 scale. */
  currentAirQuality?: AirQuality;
  /** European AQI normalized to the app's 1–5 scale, keyed by exact forecast timestamp. */
  hourlyAqiByTime: ReadonlyMap<number, number | undefined>;
  usesHourlyAqi: boolean;
  usesCurrentAqiFallback: boolean;
}

const isValidOpenWeatherAqi = (aqi: number): boolean =>
  Number.isInteger(aqi) && aqi >= 1 && aqi <= 5;

/**
 * Resolve only fresh, timestamp-matched AQI evidence for the general day plan.
 * European AQI is normalized before scoring; samples are never interpolated. Conflicting
 * duplicate samples at the same timestamp are treated as unavailable rather than guessed.
 */
export function getDailyPlanAirQualityEvidence({
  forecastTimes,
  airQuality,
  airQualityHourly,
  now = Date.now(),
}: DailyPlanAirQualityEvidenceInput): DailyPlanAirQualityEvidence {
  const currentAirQuality =
    airQuality &&
    getOptionalEvidenceFreshness(airQuality.meta, now).fresh &&
    isValidOpenWeatherAqi(airQuality.aqi)
      ? airQuality
      : undefined;

  const hourlyAqiByTime = new Map<number, number | undefined>();
  if (airQualityHourly && getOptionalEvidenceFreshness(airQualityHourly.meta, now).fresh) {
    for (const sample of airQualityHourly.hours) {
      if (!(sample.time instanceof Date) || !Number.isFinite(sample.time.getTime())) continue;
      const riskIndex = europeanAqiToOpenWeatherIndex(sample.europeanAqi);
      if (riskIndex === undefined) continue;
      const timestamp = sample.time.getTime();
      if (hourlyAqiByTime.has(timestamp)) {
        if (hourlyAqiByTime.get(timestamp) !== riskIndex) hourlyAqiByTime.set(timestamp, undefined);
      } else {
        hourlyAqiByTime.set(timestamp, riskIndex);
      }
    }
  }

  const hasExactHourlyValue = (time: Date): boolean => {
    if (!(time instanceof Date) || !Number.isFinite(time.getTime())) return false;
    return hourlyAqiByTime.get(time.getTime()) !== undefined;
  };
  const usesHourlyAqi = forecastTimes.some(hasExactHourlyValue);
  const usesCurrentAqiFallback = Boolean(currentAirQuality) && forecastTimes.some(time => !hasExactHourlyValue(time));

  return {
    currentAirQuality,
    hourlyAqiByTime,
    usesHourlyAqi,
    usesCurrentAqiFallback,
  };
}
