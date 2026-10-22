import { scoreWeatherWindow } from '../domain/decision/scoreWeatherWindow';
import {
  airLevel,
  COLD_APPARENT_C,
  EXTREME_HEAT_APPARENT_C,
  FREEZING_APPARENT_C,
  HEAT_APPARENT_C,
  rainLevel,
  windLevel,
  worseWind,
  type WindLevel,
} from '../domain/decision/thresholds';
import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../types';
import { pickMostSignificantPrecipitation } from './precipitation';

export type WeatherDecisionKind =
  | 'rain'
  | 'wind'
  | 'heat'
  | 'cold'
  | 'air-quality'
  | 'uv'
  | 'outdoor-window'
  | 'stable'
  | 'unavailable';

export type WeatherDecisionSeverity = 'info' | 'moderate' | 'high';

type WeatherDecisionBase = {
  severity: WeatherDecisionSeverity;
  time?: Date;
};

type ValuedWeatherDecision = WeatherDecisionBase & {
  kind: 'rain' | 'wind' | 'heat' | 'cold' | 'air-quality' | 'uv';
  value: number;
  amount?: number;
};

type ContextWeatherDecision = WeatherDecisionBase & {
  kind: 'outdoor-window' | 'stable' | 'unavailable';
  value?: number;
};

export type WeatherDecision = ValuedWeatherDecision | ContextWeatherDecision;

export interface WeatherDecisionInput {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  uvIndexMax?: number;
  /**
   * Best window from the shared decision snapshot (Faz 1.1). When given, the outdoor-window
   * decision uses this time (or is omitted for `null`) instead of a separate local pick.
   */
  bestWindowTime?: Date | null;
}

const HOUR_MS = 60 * 60 * 1000;
const severityRank: Record<WeatherDecisionSeverity, number> = { high: 3, moderate: 2, info: 1 };

const nextHours = (hourly: HourlyForecast[], hours: number) => {
  const sorted = [...hourly].sort((a, b) => a.time.getTime() - b.time.getTime());
  const first = sorted[0];
  if (!first) return [];
  const end = first.time.getTime() + hours * HOUR_MS;
  return sorted.filter(point => point.time.getTime() < end);
};

const effectiveWind = (point: HourlyForecast) =>
  Math.max(point.windSpeed, (point.windGust ?? 0) * 0.72);

export const getWeatherDecisions = ({
  weather,
  hourly,
  airQuality,
  uvIndexMax,
  bestWindowTime,
}: WeatherDecisionInput): WeatherDecision[] => {
  const next = nextHours(hourly, 12);
  const decisions: WeatherDecision[] = [];

  const rainiest = pickMostSignificantPrecipitation(next);
  if (rainiest && rainLevel(rainiest.pop, rainiest.precipitationMm) === 'likely') {
    const amount = rainiest.precipitationMm ?? 0;
    decisions.push({
      kind: 'rain',
      severity: amount >= 4 || rainiest.pop >= 0.75 ? 'high' : 'moderate',
      time: rainiest.time,
      value: rainiest.pop,
      amount: rainiest.precipitationMm,
    });
  }

  const strongestWind = next.reduce<HourlyForecast | undefined>(
    (best, point) => (!best || effectiveWind(point) > effectiveWind(best) ? point : best),
    undefined
  );
  // Shared thresholds (plan v3 Faz 0.4): the same hour gets the same wind verdict here as in
  // the day plan and the commute plan. `effectiveWind` only decides which value to display.
  const windVerdict = next.reduce<WindLevel>(
    (level, point) => worseWind(level, windLevel(point.windSpeed, point.windGust)),
    windLevel(weather.windSpeed)
  );
  if (windVerdict !== 'normal') {
    const forecastDominates = strongestWind && effectiveWind(strongestWind) >= weather.windSpeed;
    const displayedWind = forecastDominates
      ? Math.max(strongestWind.windSpeed, strongestWind.windGust ?? 0)
      : weather.windSpeed;
    decisions.push({
      kind: 'wind',
      severity: windVerdict === 'strong' ? 'high' : 'moderate',
      time: forecastDominates ? strongestWind.time : undefined,
      value: displayedWind,
    });
  }

  const hottest = next.reduce<HourlyForecast | undefined>((best, point) => {
    const apparent = point.apparentTemperature ?? point.temp;
    const bestApparent = best ? (best.apparentTemperature ?? best.temp) : -Infinity;
    return !best || apparent > bestApparent ? point : best;
  }, undefined);
  const hottestForecastTemperature = hottest
    ? (hottest.apparentTemperature ?? hottest.temp)
    : -Infinity;
  const maxTemperature = Math.max(weather.feelsLike, hottestForecastTemperature);
  if (maxTemperature >= HEAT_APPARENT_C) {
    decisions.push({
      kind: 'heat',
      severity: maxTemperature >= EXTREME_HEAT_APPARENT_C ? 'high' : 'moderate',
      time: hottestForecastTemperature >= weather.feelsLike ? hottest?.time : undefined,
      value: maxTemperature,
    });
  }

  const coldest = next.reduce<HourlyForecast | undefined>((best, point) => {
    const apparent = point.apparentTemperature ?? point.temp;
    const bestApparent = best ? (best.apparentTemperature ?? best.temp) : Infinity;
    return !best || apparent < bestApparent ? point : best;
  }, undefined);
  const coldestForecastTemperature = coldest
    ? (coldest.apparentTemperature ?? coldest.temp)
    : Infinity;
  const minTemperature = Math.min(weather.feelsLike, coldestForecastTemperature);
  if (minTemperature <= COLD_APPARENT_C) {
    decisions.push({
      kind: 'cold',
      severity: minTemperature <= FREEZING_APPARENT_C ? 'high' : 'moderate',
      time: coldestForecastTemperature <= weather.feelsLike ? coldest?.time : undefined,
      value: minTemperature,
    });
  }

  const air = airLevel(airQuality?.aqi);
  if (airQuality && (air === 'poor' || air === 'very-poor')) {
    decisions.push({
      kind: 'air-quality',
      severity: air === 'very-poor' ? 'high' : 'moderate',
      value: airQuality.aqi,
    });
  }

  const hourlyUv = Math.max(0, ...next.map(point => point.uvIndex ?? 0));
  const modeledUv = Math.max(hourlyUv, uvIndexMax ?? 0);
  if (modeledUv >= 6) {
    decisions.push({
      kind: 'uv',
      severity: modeledUv >= 8 ? 'high' : 'moderate',
      value: modeledUv,
    });
  }

  const scored = next.map(point => ({
    point,
    result: scoreWeatherWindow({
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
    }),
  }));
  const outdoor = scored.reduce<(typeof scored)[number] | undefined>(
    (best, entry) => (!best || entry.result.score > best.result.score ? entry : best),
    undefined
  );
  const snapshotPoint =
    bestWindowTime === undefined
      ? outdoor
      : bestWindowTime === null
        ? undefined
        : scored.find(entry => entry.point.time.getTime() === bestWindowTime.getTime());
  if (snapshotPoint && snapshotPoint.result.score >= 85) {
    decisions.push({
      kind: 'outdoor-window',
      severity: 'info',
      time: snapshotPoint.point.time,
      value: snapshotPoint.point.apparentTemperature ?? snapshotPoint.point.temp,
    });
  }

  if (decisions.length === 0) {
    decisions.push({ kind: next.length === 0 ? 'unavailable' : 'stable', severity: 'info' });
  }

  return decisions.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]).slice(0, 3);
};
