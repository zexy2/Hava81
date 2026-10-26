import type {
  AirQuality,
  AirQualityHourly,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { getDailyPlanAirQualityEvidence } from '../decision/airQualityEvidence';
import { dropElapsedSlots } from '../decision/aggregateHorizon';
import { findWindows } from './findWindows';
import { getPlanProfile } from './profiles';
import { scoreHour } from './scoreHour';
import { getPlanConfidence, worstPlanConfidence } from './confidence';
import type {
  PlanAvailability,
  PlanIntent,
  PlanSnapshot,
  PlanTemperatureSensitivity,
} from './types';

export interface GetPlanSnapshotInput {
  intent: PlanIntent;
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  airQualityHourly?: AirQualityHourly;
  durationMinutes?: number;
  availability?: PlanAvailability;
  sensitivity?: PlanTemperatureSensitivity;
  now?: Date;
}

/**
 * Pure plan-engine entry point for P1.3. It produces scored future slots and up to three
 * non-overlapping windows; no UI copy, persistence or side effects live in this module.
 */
export const getPlanSnapshot = ({
  intent,
  weather,
  hourly,
  airQuality,
  airQualityHourly,
  durationMinutes,
  availability,
  sensitivity,
  now = new Date(),
}: GetPlanSnapshotInput): PlanSnapshot => {
  const profile = getPlanProfile(intent);
  const duration =
    Number.isFinite(durationMinutes) && (durationMinutes as number) > 0
      ? Math.max(1, Math.min(12 * 60, Math.round(durationMinutes as number)))
      : profile.durationMinutes;
  const timezoneOffsetSeconds = weather.meta.timezoneOffsetSeconds;
  const valid = [...hourly]
    .filter(point => point.time instanceof Date && Number.isFinite(point.time.getTime()))
    .filter(
      point =>
        Number.isFinite(point.temp) && Number.isFinite(point.windSpeed) && point.windSpeed >= 0
    )
    .sort((a, b) => a.time.getTime() - b.time.getTime());
  // Keep the step in progress (14:00 at 14:20): it is "now", not the past.
  const future = dropElapsedSlots(valid, now);
  const airQualityEvidence = getDailyPlanAirQualityEvidence({
    forecastTimes: future.map(point => point.time),
    airQuality,
    airQualityHourly,
    now: now.getTime(),
  });

  const hours = future.map(point =>
    scoreHour({
      intent,
      point,
      timezoneOffsetSeconds,
      now,
      airQuality: airQualityEvidence.currentAirQuality,
      airQualityIndexOverride: airQualityEvidence.hourlyAqiByTime.get(point.time.getTime()),
      sensitivity,
    })
  );
  const windows = findWindows(hours, {
    durationMinutes: duration,
    timezoneOffsetSeconds,
    availability,
    maxWindows: 3,
  });

  const nearHorizon = hours.filter(hour => hour.forecastHoursAhead <= 72);
  const dataCoverage = nearHorizon.length
    ? nearHorizon.reduce((sum, hour) => sum + hour.dataCoverage, 0) / nearHorizon.length
    : 0;
  const highestScoringWindow = windows.reduce<(typeof windows)[number] | undefined>(
    (best, window) => (!best || window.score > best.score ? window : best),
    undefined
  );
  const horizonConfidence = highestScoringWindow?.confidence ?? hours[0]?.confidence ?? 'low';
  const coverageConfidence = getPlanConfidence(
    highestScoringWindow?.slots[0]?.forecastHoursAhead ?? hours[0]?.forecastHoursAhead ?? Infinity,
    dataCoverage
  );

  return {
    intent,
    durationMinutes: duration,
    generatedAt: now,
    hours,
    windows,
    confidence: worstPlanConfidence(horizonConfidence, coverageConfidence),
    dataCoverage: Math.round(dataCoverage * 100) / 100,
  };
};
