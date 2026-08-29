import type { HourlyForecast } from '../../types';
import type { TemperatureSensitivity } from '../activity/types';
import { getScoreBand, scoreWeatherWindow } from '../decision/scoreWeatherWindow';
import type { Hava81ScoreBand } from '../decision/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const MAX_MATCH_DISTANCE_MS = 2 * 60 * 60 * 1000;
const SCORE_CHANGE_THRESHOLD = 8;

export type CommuteUmbrellaAdvice = 'take' | 'consider' | 'no';
export type CommuteChangeKind =
  | 'rain-increase'
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
  | 'heat'
  | 'cold'
  | 'strong-wind'
  | 'wind-caution'
  | 'poor-air'
  | 'stable';

export interface CommuteWindow {
  targetClock: string;
  targetTime: Date;
  forecastTime: Date;
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  windSpeed: number;
  windGust?: number;
  score: number;
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
    airQualityIndex?: number;
  };
}

interface BuildCommutePlanInput {
  hourly: HourlyForecast[];
  commuteStart?: string;
  commuteEnd?: string;
  timezoneOffsetSeconds?: number;
  now?: Date;
  airQualityIndex?: number;
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

const nextOccurrence = (
  clockMinutes: number,
  now: Date,
  timezoneOffsetSeconds: number
) => {
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
  timezoneOffsetSeconds: number,
  airQualityIndex?: number
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
    airQualityIndex,
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
    precipitationProbability: point.pop,
    windSpeed: point.windSpeed ?? 0,
    windGust: point.windGust,
    score: scored.score,
    band: getScoreBand(scored.score),
  };
};

const effectiveWind = (window: CommuteWindow) =>
  Math.max(window.windSpeed, Number.isFinite(window.windGust) ? (window.windGust as number) * 0.72 : 0);

const advicePriority: CommuteAdviceCode[] = [
  'umbrella-take',
  'strong-wind',
  'heat',
  'cold',
  'poor-air',
  'umbrella-consider',
  'wind-caution',
  'stable',
];

export const buildCommutePlan = ({
  hourly,
  commuteStart,
  commuteEnd,
  timezoneOffsetSeconds = 0,
  now = new Date(),
  airQualityIndex,
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

  const outbound = buildWindow(
    outboundPoint,
    commuteStart!,
    startTarget,
    timezoneOffsetSeconds,
    airQualityIndex
  );
  const returnWindow = buildWindow(
    returnPoint,
    commuteEnd!,
    endTarget,
    timezoneOffsetSeconds,
    airQualityIndex
  );

  const maxRain = Math.max(
    outbound.precipitationProbability,
    returnWindow.precipitationProbability
  );
  const umbrella: CommuteUmbrellaAdvice =
    maxRain >= 0.5 ? 'take' : maxRain >= 0.25 ? 'consider' : 'no';

  const maxEffectiveWind = Math.max(effectiveWind(outbound), effectiveWind(returnWindow));
  const maxApparentTemperature = Math.max(
    outbound.apparentTemperature,
    returnWindow.apparentTemperature
  );
  const minApparentTemperature = Math.min(
    outbound.apparentTemperature,
    returnWindow.apparentTemperature
  );
  const rainIncrease = returnWindow.precipitationProbability - outbound.precipitationProbability;
  const temperatureDelta = returnWindow.apparentTemperature - outbound.apparentTemperature;
  const scoreDelta = returnWindow.score - outbound.score;

  let change: CommuteChangeKind = 'stable';
  let changeValue: number | undefined;
  if (rainIncrease >= 0.25) {
    change = 'rain-increase';
    changeValue = Math.round(rainIncrease * 100);
  } else if (maxEffectiveWind >= 17.2) {
    change = 'strong-wind';
  } else if (maxEffectiveWind >= 10.8) {
    change = 'wind-caution';
  } else if (temperatureDelta <= -6) {
    change = 'temperature-drop';
    changeValue = Math.round(Math.abs(temperatureDelta));
  } else if (temperatureDelta >= 6) {
    change = 'temperature-rise';
    changeValue = Math.round(temperatureDelta);
  } else if (scoreDelta <= -SCORE_CHANGE_THRESHOLD) {
    change = 'comfort-worsens';
    changeValue = Math.round(Math.abs(scoreDelta));
  } else if (scoreDelta >= SCORE_CHANGE_THRESHOLD) {
    change = 'comfort-improves';
    changeValue = Math.round(scoreDelta);
  }

  const heatThreshold =
    temperatureSensitivity === 'heat' ? 27 : temperatureSensitivity === 'cold' ? 33 : 30;
  const coldThreshold =
    temperatureSensitivity === 'cold' ? 10 : temperatureSensitivity === 'heat' ? 4 : 7;
  const advice: CommuteAdviceCode[] = [];
  if (umbrella === 'take') advice.push('umbrella-take');
  else if (umbrella === 'consider') advice.push('umbrella-consider');
  if (maxEffectiveWind >= 17.2) advice.push('strong-wind');
  else if (maxEffectiveWind >= 10.8) advice.push('wind-caution');
  if (maxApparentTemperature >= heatThreshold) advice.push('heat');
  if (minApparentTemperature <= coldThreshold) advice.push('cold');
  if ((airQualityIndex ?? 0) >= 4) advice.push('poor-air');
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
      airQualityIndex,
    },
  };
};
