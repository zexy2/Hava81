import type { HourlyForecast, AirQuality } from '../../types';
import { getOptionalEvidenceFreshness } from '../../utils/optionalEvidenceFreshness';
import { isDaylightPoint, isWithinActiveHours } from '../decision/eligibility';
import { getScoreBand, scoreWeatherWindow } from '../decision/scoreWeatherWindow';
import type { Hava81ScoreFactor } from '../decision/types';
import { getPlanConfidence } from './confidence';
import { getPlanProfile } from './profiles';
import type { PlanFactor, PlanHourScore, PlanIntent, PlanPenalties } from './types';

const HOUR_MS = 60 * 60 * 1000;

const penaltyKey: Readonly<
  Record<Hava81ScoreFactor, keyof Omit<PlanPenalties, 'comfort' | 'total'>>
> = {
  thermal: 'thermal',
  precipitation: 'precipitation',
  wind: 'wind',
  'air-quality': 'airQuality',
  uv: 'uv',
  visibility: 'visibility',
  'severe-weather': 'severeWeather',
  compound: 'compound',
};

const roundPenalty = (value: number): number =>
  Math.round(Math.max(0, Number.isFinite(value) ? value : 0) * 10) / 10;

const comfortPenaltyFor = (
  apparentTemperature: number,
  range: readonly [number, number]
): number => {
  const distance =
    apparentTemperature < range[0]
      ? range[0] - apparentTemperature
      : apparentTemperature > range[1]
        ? apparentTemperature - range[1]
        : 0;
  return Math.min(18, distance * 1.6);
};

const emptyPenalties = (total: number): PlanPenalties => ({
  thermal: total,
  precipitation: 0,
  wind: 0,
  airQuality: 0,
  uv: 0,
  visibility: 0,
  severeWeather: 0,
  compound: 0,
  comfort: 0,
  total,
});

export interface ScoreHourInput {
  intent: PlanIntent;
  point: HourlyForecast;
  timezoneOffsetSeconds: number;
  now?: Date;
  airQuality?: AirQuality;
}

/**
 * Score one forecast slot for an intent. Weather penalties remain additive and auditable; intent
 * weights change only the contribution of each named factor. Stale optional AQI is ignored.
 */
export const scoreHour = ({
  intent,
  point,
  timezoneOffsetSeconds,
  now = new Date(),
  airQuality,
}: ScoreHourInput): PlanHourScore => {
  const profile = getPlanProfile(intent);
  const timeIsValid = point.time instanceof Date && Number.isFinite(point.time.getTime());
  const requiredWeatherIsValid =
    timeIsValid &&
    Number.isFinite(point.temp) &&
    Number.isFinite(point.windSpeed) &&
    point.windSpeed >= 0;
  if (!requiredWeatherIsValid) {
    return {
      intent,
      time: point.time,
      score: 0,
      band: 'difficult',
      temperature: point.temp,
      apparentTemperature: Number.isFinite(point.apparentTemperature)
        ? (point.apparentTemperature as number)
        : point.temp,
      windSpeed: point.windSpeed,
      reasons: [],
      penalties: emptyPenalties(100),
      eligible: false,
      gateReasons: ['invalid-weather-data'],
      confidence: 'low',
      forecastHoursAhead: Number.POSITIVE_INFINITY,
      dataCoverage: 0,
    };
  }

  const freshAirQuality =
    airQuality && getOptionalEvidenceFreshness(airQuality.meta, now.getTime()).fresh
      ? airQuality
      : undefined;
  const rawAqi = freshAirQuality?.aqi;
  const airQualityIndex =
    Number.isInteger(rawAqi) && (rawAqi as number) >= 1 && (rawAqi as number) <= 5
      ? rawAqi
      : undefined;
  const base = scoreWeatherWindow({
    time: point.time,
    temperature: point.temp,
    apparentTemperature: point.apparentTemperature,
    humidity: point.humidity,
    precipitationProbability: point.pop,
    precipitationMm: point.precipitationMm,
    windSpeed: point.windSpeed,
    windGust: point.windGust,
    airQualityIndex,
    uvIndex: point.uvIndex,
    visibility: point.visibility,
    weatherCode: point.weatherCode,
  });

  const comfort = comfortPenaltyFor(base.apparentTemperature, profile.comfortRangeC);
  const weighted: PlanPenalties = {
    thermal: 0,
    precipitation: 0,
    wind: 0,
    airQuality: 0,
    uv: 0,
    visibility: 0,
    severeWeather: 0,
    compound: 0,
    comfort: roundPenalty(comfort),
    total: 0,
  };

  for (const impact of base.impacts) {
    const key = penaltyKey[impact.factor] as keyof Omit<PlanPenalties, 'comfort' | 'total'>;
    const weight = profile.weights[impact.factor as PlanFactor];
    weighted[key] += impact.penalty * weight;
  }
  weighted.thermal += comfort * profile.weights.thermal;

  for (const key of [
    'thermal',
    'precipitation',
    'wind',
    'airQuality',
    'uv',
    'visibility',
    'severeWeather',
    'compound',
  ] as const) {
    weighted[key] = roundPenalty(weighted[key]);
  }
  weighted.total = roundPenalty(
    weighted.thermal +
      weighted.precipitation +
      weighted.wind +
      weighted.airQuality +
      weighted.uv +
      weighted.visibility +
      weighted.severeWeather +
      weighted.compound
  );

  let score = Math.max(0, Math.min(100, Math.round(100 - weighted.total)));
  const gateReasons: PlanHourScore['gateReasons'] = [];
  if (profile.requiresDaylight && !isDaylightPoint(point)) gateReasons.push('daylight-required');
  if (profile.activeHoursOnly && !isWithinActiveHours(point.time, timezoneOffsetSeconds)) {
    gateReasons.push('outside-active-hours');
  }
  if (
    (Number.isFinite(point.pop) && (point.pop as number) >= profile.maxPrecipitationProbability) ||
    (Number.isFinite(point.precipitationMm) &&
      (point.precipitationMm as number) > profile.maxPrecipitationMm)
  ) {
    gateReasons.push('precipitation-limit');
  }
  if (
    point.windSpeed > profile.maxWindSpeedMs ||
    (Number.isFinite(point.windGust) && (point.windGust as number) > profile.maxWindGustMs)
  ) {
    gateReasons.push('wind-limit');
  }
  if (base.reasons.includes('severe-weather')) gateReasons.push('severe-weather');

  const forecastHoursAhead = Math.max(0, (point.time.getTime() - now.getTime()) / HOUR_MS);
  // Coverage is evidence completeness, not the presence of a derived value. Apparent temperature
  // is useful for comfort scoring but may be derived from other weather fields, so it is excluded
  // from both the independent-signal numerator and denominator.
  const signals = [
    point.temp,
    point.humidity,
    point.pop,
    point.precipitationMm,
    point.windSpeed,
    point.windGust,
    airQualityIndex,
    point.uvIndex,
    point.visibility,
    point.weatherCode,
  ];
  const knownSignals = signals.filter(Number.isFinite).length;
  const dataCoverage = knownSignals / signals.length;
  const reasons = [...base.reasons];
  if (
    comfort >= 8 &&
    base.apparentTemperature > profile.comfortRangeC[1] &&
    !reasons.includes('heat')
  ) {
    reasons.push('heat');
  } else if (
    comfort >= 8 &&
    base.apparentTemperature < profile.comfortRangeC[0] &&
    !reasons.includes('cold')
  ) {
    reasons.push('cold');
  }

  // Intent weights tune comfort/preferences, not hard safety ceilings. Preserve the absolute
  // caps from the shared score model so a zero-weight factor cannot make a dangerous hour look
  // excellent (e.g. AQI 5 for laundry, or severe thunderstorm weather codes).
  if (base.apparentTemperature >= 43) score = Math.min(score, 30);
  else if (base.apparentTemperature >= 40) score = Math.min(score, 45);
  if (base.apparentTemperature <= -20) score = Math.min(score, 20);
  else if (base.apparentTemperature <= -10) score = Math.min(score, 35);
  if ((point.precipitationMm ?? 0) >= 7.5) score = Math.min(score, 35);
  if (point.windSpeed >= 20 || (point.windGust ?? 0) >= 25) score = Math.min(score, 30);
  if ((airQualityIndex ?? 0) >= 5) score = Math.min(score, 45);
  if ((base.impacts.find(impact => impact.factor === 'severe-weather')?.penalty ?? 0) >= 28) {
    score = Math.min(score, 25);
  }
  // Match the shared model's label invariant even when intent weighting softens a surfaced risk.
  if (reasons.length > 0) score = Math.min(score, 96);

  return {
    intent,
    time: point.time,
    score,
    band: getScoreBand(score),
    temperature: point.temp,
    apparentTemperature: base.apparentTemperature,
    humidity: point.humidity,
    precipitationProbability: point.pop,
    precipitationMm: point.precipitationMm,
    windSpeed: point.windSpeed,
    windGust: point.windGust,
    airQualityIndex,
    uvIndex: point.uvIndex,
    visibility: point.visibility,
    weatherCode: point.weatherCode,
    reasons,
    penalties: weighted,
    eligible: gateReasons.length === 0,
    gateReasons,
    confidence: getPlanConfidence(forecastHoursAhead, dataCoverage),
    forecastHoursAhead,
    dataCoverage,
  };
};
