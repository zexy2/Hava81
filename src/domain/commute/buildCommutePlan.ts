import type { HourlyForecast } from '../../types';
import type { TemperatureSensitivity } from '../activity/types';
import { getScoreBand, scoreWeatherWindow } from '../decision/scoreWeatherWindow';
import {
  COLD_APPARENT_C,
  HEAT_APPARENT_C,
  rainLevel,
  windLevel,
  worseWind,
} from '../decision/thresholds';
import type { Hava81ScoreBand } from '../decision/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const MAX_MATCH_DISTANCE_MS = 2 * 60 * 60 * 1000;
const SCORE_CHANGE_THRESHOLD = 8;

export type CommuteUmbrellaAdvice = 'take' | 'consider' | 'no' | 'unknown';
export type CommuteChangeKind =
  | 'precipitation-unknown'
  | 'rain-increase'
  | 'rain-amount-increase'
  | 'strong-wind'
  | 'wind-caution'
  | 'temperature-drop'
  | 'temperature-rise'
  | 'comfort-worsens'
  | 'comfort-improves'
  | 'stable';
export type CommuteAdviceCode =
  | 'umbrella-take'
  | 'umbrella-consider'
  | 'umbrella-unknown'
  | 'heat'
  | 'cold'
  | 'strong-wind'
  | 'wind-caution'
  | 'stable';

export interface CommuteWindow {
  targetClock: string;
  targetTime: Date;
  forecastTime: Date;
  temperature: number;
  apparentTemperature: number;
  precipitationProbability?: number;
  precipitationMm?: number;
  windSpeed: number;
  windGust?: number;
  score: number;
  /** The same hour scored as dry: comfort without rain, which has its own comparison. */
  comfortScore: number;
  band: Hava81ScoreBand;
}

export interface CommutePlan {
  outbound: CommuteWindow;
  return: CommuteWindow;
  umbrella: CommuteUmbrellaAdvice;
  change: CommuteChangeKind;
  changeValue?: number;
  advice: CommuteAdviceCode[];
  primaryAdvice: CommuteAdviceCode;
  summary: {
    maxApparentTemperature: number;
    minApparentTemperature: number;
    maxEffectiveWind: number;
  };
}

interface BuildCommutePlanInput {
  hourly: HourlyForecast[];
  commuteStart?: string;
  commuteEnd?: string;
  timezoneOffsetSeconds: number;
  now?: Date;
  temperatureSensitivity?: TemperatureSensitivity;
}

const parseClockMinutes = (clock?: string): number | null => {
  if (!clock) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const shiftedMs = (date: Date, timezoneOffsetSeconds: number) =>
  date.getTime() + timezoneOffsetSeconds * 1000;

const nextOccurrence = (clockMinutes: number, now: Date, timezoneOffsetSeconds: number) => {
  const localNow = shiftedMs(now, timezoneOffsetSeconds);
  const dayStart = Math.floor(localNow / DAY_MS) * DAY_MS;
  let target = dayStart + clockMinutes * MINUTE_MS;
  if (target < localNow) target += DAY_MS;
  return target;
};

const toActualDate = (shiftedTimestamp: number, timezoneOffsetSeconds: number) =>
  new Date(shiftedTimestamp - timezoneOffsetSeconds * 1000);

const nearestForecast = (
  hourly: HourlyForecast[],
  targetShiftedMs: number,
  timezoneOffsetSeconds: number
) => {
  let nearest: HourlyForecast | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const point of hourly) {
    const distance = Math.abs(shiftedMs(point.time, timezoneOffsetSeconds) - targetShiftedMs);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }

  return nearest && nearestDistance <= MAX_MATCH_DISTANCE_MS ? nearest : undefined;
};

const buildWindow = (
  point: HourlyForecast,
  targetClock: string,
  targetShiftedMs: number,
  timezoneOffsetSeconds: number
): CommuteWindow => {
  const scored = scoreWeatherWindow({
    time: point.time,
    temperature: point.temp,
    apparentTemperature: point.apparentTemperature,
    humidity: point.humidity,
    precipitationProbability: point.pop,
    precipitationMm: point.precipitationMm,
    windSpeed: point.windSpeed,
    windGust: point.windGust,
    uvIndex: point.uvIndex,
    visibility: point.visibility,
    weatherCode: point.weatherCode,
  });

  return {
    targetClock,
    targetTime: toActualDate(targetShiftedMs, timezoneOffsetSeconds),
    forecastTime: point.time,
    temperature: point.temp,
    apparentTemperature: scored.apparentTemperature,
    precipitationProbability: scored.precipitationProbability,
    precipitationMm: scored.precipitationMm,
    windSpeed: point.windSpeed,
    windGust: point.windGust,
    score: scored.score,
    comfortScore: scoreWeatherWindow({
      time: point.time,
      temperature: point.temp,
      apparentTemperature: point.apparentTemperature,
      humidity: point.humidity,
      precipitationProbability: 0,
      precipitationMm: 0,
      windSpeed: point.windSpeed,
      windGust: point.windGust,
      uvIndex: point.uvIndex,
      visibility: point.visibility,
    }).score,
    band: getScoreBand(scored.score),
  };
};

const isProbabilityEvidence = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const isAmountEvidence = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const hasRainEvidence = (window: CommuteWindow): boolean =>
  isProbabilityEvidence(window.precipitationProbability) ||
  isAmountEvidence(window.precipitationMm);

const effectiveWind = (window: CommuteWindow) =>
  Math.max(
    window.windSpeed,
    Number.isFinite(window.windGust) ? (window.windGust as number) * 0.72 : 0
  );

const advicePriority: CommuteAdviceCode[] = [
  'umbrella-take',
  'strong-wind',
  'heat',
  'cold',
  'umbrella-consider',
  'wind-caution',
  'umbrella-unknown',
  'stable',
];

export const buildCommutePlan = ({
  hourly,
  commuteStart,
  commuteEnd,
  timezoneOffsetSeconds,
  now = new Date(),
  temperatureSensitivity = 'balanced',
}: BuildCommutePlanInput): CommutePlan | null => {
  const startMinutes = parseClockMinutes(commuteStart);
  const endMinutes = parseClockMinutes(commuteEnd);
  if (startMinutes === null || endMinutes === null || hourly.length === 0) return null;

  const startTarget = nextOccurrence(startMinutes, now, timezoneOffsetSeconds);
  const startDay = Math.floor(startTarget / DAY_MS) * DAY_MS;
  let endTarget = startDay + endMinutes * MINUTE_MS;
  if (endTarget <= startTarget) endTarget += DAY_MS;

  const outboundPoint = nearestForecast(hourly, startTarget, timezoneOffsetSeconds);
  const returnPoint = nearestForecast(hourly, endTarget, timezoneOffsetSeconds);
  if (!outboundPoint || !returnPoint) return null;
  if (
    !Number.isFinite(outboundPoint.windSpeed) ||
    (outboundPoint.windSpeed as number) < 0 ||
    !Number.isFinite(returnPoint.windSpeed) ||
    (returnPoint.windSpeed as number) < 0
  ) {
    return null;
  }

  const outbound = buildWindow(outboundPoint, commuteStart!, startTarget, timezoneOffsetSeconds);
  const returnWindow = buildWindow(returnPoint, commuteEnd!, endTarget, timezoneOffsetSeconds);

  const knownProbabilities = [
    outbound.precipitationProbability,
    returnWindow.precipitationProbability,
  ].filter(isProbabilityEvidence);
  const knownAmounts = [outbound.precipitationMm, returnWindow.precipitationMm].filter(
    isAmountEvidence
  );
  const maxRain = knownProbabilities.length ? Math.max(...knownProbabilities) : undefined;
  const maxRainAmount = knownAmounts.length ? Math.max(...knownAmounts) : undefined;
  const rain = rainLevel(maxRain, maxRainAmount);
  const hasOutboundRainEvidence = hasRainEvidence(outbound);
  const hasReturnRainEvidence = hasRainEvidence(returnWindow);
  const umbrella: CommuteUmbrellaAdvice =
    rain === 'likely'
      ? 'take'
      : rain === 'possible'
        ? 'consider'
        : rain === 'none' && hasOutboundRainEvidence && hasReturnRainEvidence
          ? 'no'
          : 'unknown';
  // Shared thresholds (plan v3 Faz 0.4); `maxEffectiveWind` stays as the displayed summary.
  const wind = worseWind(
    windLevel(outbound.windSpeed, outbound.windGust),
    windLevel(returnWindow.windSpeed, returnWindow.windGust)
  );

  const maxEffectiveWind = Math.max(effectiveWind(outbound), effectiveWind(returnWindow));
  const maxApparentTemperature = Math.max(
    outbound.apparentTemperature,
    returnWindow.apparentTemperature
  );
  const minApparentTemperature = Math.min(
    outbound.apparentTemperature,
    returnWindow.apparentTemperature
  );
  const hasComparableRainProbability =
    isProbabilityEvidence(outbound.precipitationProbability) &&
    isProbabilityEvidence(returnWindow.precipitationProbability);
  const rainIncrease = hasComparableRainProbability
    ? (returnWindow.precipitationProbability as number) -
      (outbound.precipitationProbability as number)
    : undefined;
  const hasComparableRainAmount =
    isAmountEvidence(outbound.precipitationMm) && isAmountEvidence(returnWindow.precipitationMm);
  const rainAmountIncrease = hasComparableRainAmount
    ? (returnWindow.precipitationMm as number) - (outbound.precipitationMm as number)
    : undefined;
  const temperatureDelta = returnWindow.apparentTemperature - outbound.apparentTemperature;
  // Rain is compared on its own above; the comfort delta must not count it a second time.
  const scoreDelta = returnWindow.comfortScore - outbound.comfortScore;

  let change: CommuteChangeKind = 'stable';
  let changeValue: number | undefined;
  if (rainIncrease !== undefined && rainIncrease >= 0.25) {
    change = 'rain-increase';
    changeValue = Math.round(rainIncrease * 100);
  } else if (rainAmountIncrease !== undefined && rainAmountIncrease >= 0.2) {
    change = 'rain-amount-increase';
    changeValue = Math.round(rainAmountIncrease * 10) / 10;
  } else if (wind === 'strong') {
    change = 'strong-wind';
  } else if (wind === 'caution') {
    change = 'wind-caution';
  } else if (temperatureDelta <= -6) {
    change = 'temperature-drop';
    changeValue = Math.round(Math.abs(temperatureDelta));
  } else if (temperatureDelta >= 6) {
    change = 'temperature-rise';
    changeValue = Math.round(temperatureDelta);
  } else if (!hasOutboundRainEvidence || !hasReturnRainEvidence) {
    // Missing rain evidence also caps the hourly score; don't present that data gap as a
    // real comfort deterioration/improvement between the two commute windows.
    change = 'precipitation-unknown';
  } else if (scoreDelta <= -SCORE_CHANGE_THRESHOLD) {
    change = 'comfort-worsens';
    changeValue = Math.round(Math.abs(scoreDelta));
  } else if (scoreDelta >= SCORE_CHANGE_THRESHOLD) {
    change = 'comfort-improves';
    changeValue = Math.round(scoreDelta);
  }

  // Personal sensitivity shifts the shared base values by 3 °C.
  const heatThreshold =
    HEAT_APPARENT_C +
    (temperatureSensitivity === 'heat' ? -3 : temperatureSensitivity === 'cold' ? 3 : 0);
  const coldThreshold =
    COLD_APPARENT_C +
    (temperatureSensitivity === 'cold' ? 3 : temperatureSensitivity === 'heat' ? -3 : 0);
  const advice: CommuteAdviceCode[] = [];
  if (umbrella === 'take') advice.push('umbrella-take');
  else if (umbrella === 'consider') advice.push('umbrella-consider');
  else if (umbrella === 'unknown') advice.push('umbrella-unknown');
  if (wind === 'strong') advice.push('strong-wind');
  else if (wind === 'caution') advice.push('wind-caution');
  if (maxApparentTemperature >= heatThreshold) advice.push('heat');
  if (minApparentTemperature <= coldThreshold) advice.push('cold');
  if (advice.length === 0) advice.push('stable');

  const uniqueAdvice = [...new Set(advice)];
  const primaryAdvice = advicePriority.find(code => uniqueAdvice.includes(code)) ?? 'stable';

  return {
    outbound,
    return: returnWindow,
    umbrella,
    change,
    changeValue,
    advice: uniqueAdvice,
    primaryAdvice,
    summary: {
      maxApparentTemperature,
      minApparentTemperature,
      maxEffectiveWind,
    },
  };
};
