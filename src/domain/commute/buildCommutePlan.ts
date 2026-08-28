import type { HourlyForecast } from '../../types';
import { getScoreBand, scoreWeatherWindow } from '../decision/scoreWeatherWindow';
import type { Hava81ScoreBand } from '../decision/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const MAX_MATCH_DISTANCE_MS = 2 * 60 * 60 * 1000;

export type CommuteUmbrellaAdvice = 'take' | 'consider' | 'no';
export type CommuteChangeKind =
  | 'rain-increase'
  | 'strong-wind'
  | 'wind-caution'
  | 'temperature-drop'
  | 'temperature-rise'
  | 'stable';

export interface CommuteWindow {
  targetClock: string;
  targetTime: Date;
  forecastTime: Date;
  temperature: number;
  precipitationProbability: number;
  windSpeed: number;
  score: number;
  band: Hava81ScoreBand;
}

export interface CommutePlan {
  outbound: CommuteWindow;
  return: CommuteWindow;
  umbrella: CommuteUmbrellaAdvice;
  change: CommuteChangeKind;
  changeValue?: number;
}

interface BuildCommutePlanInput {
  hourly: HourlyForecast[];
  commuteStart?: string;
  commuteEnd?: string;
  timezoneOffsetSeconds?: number;
  now?: Date;
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
    precipitationProbability: point.pop,
    windSpeed: point.windSpeed ?? 0,
    score: scored.score,
    band: getScoreBand(scored.score),
  };
};

export const buildCommutePlan = ({
  hourly,
  commuteStart,
  commuteEnd,
  timezoneOffsetSeconds = 0,
  now = new Date(),
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
    timezoneOffsetSeconds
  );
  const returnWindow = buildWindow(
    returnPoint,
    commuteEnd!,
    endTarget,
    timezoneOffsetSeconds
  );

  const maxRain = Math.max(
    outbound.precipitationProbability,
    returnWindow.precipitationProbability
  );
  const umbrella: CommuteUmbrellaAdvice =
    maxRain >= 0.5 ? 'take' : maxRain >= 0.25 ? 'consider' : 'no';

  const maxWind = Math.max(outbound.windSpeed, returnWindow.windSpeed);
  const rainIncrease = returnWindow.precipitationProbability - outbound.precipitationProbability;
  const temperatureDelta = returnWindow.temperature - outbound.temperature;

  let change: CommuteChangeKind = 'stable';
  let changeValue: number | undefined;
  if (rainIncrease >= 0.25) {
    change = 'rain-increase';
    changeValue = Math.round(rainIncrease * 100);
  } else if (maxWind >= 17.2) {
    change = 'strong-wind';
  } else if (maxWind >= 10.8) {
    change = 'wind-caution';
  } else if (temperatureDelta <= -6) {
    change = 'temperature-drop';
    changeValue = Math.round(Math.abs(temperatureDelta));
  } else if (temperatureDelta >= 6) {
    change = 'temperature-rise';
    changeValue = Math.round(temperatureDelta);
  }

  return {
    outbound,
    return: returnWindow,
    umbrella,
    change,
    changeValue,
  };
};
