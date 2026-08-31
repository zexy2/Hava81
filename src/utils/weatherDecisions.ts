import { scoreWeatherWindow } from '../domain/decision/scoreWeatherWindow';
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
  | 'stable';

export type WeatherDecisionSeverity = 'info' | 'moderate' | 'high';

export interface WeatherDecision {
  kind: WeatherDecisionKind;
  severity: WeatherDecisionSeverity;
  time?: Date;
  value?: number;
  amount?: number;
}

export interface WeatherDecisionInput {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  uvIndexMax?: number;
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
  Math.max(point.windSpeed ?? 0, (point.windGust ?? 0) * 0.72);

export const getWeatherDecisions = ({
  weather,
  hourly,
  airQuality,
  uvIndexMax,
}: WeatherDecisionInput): WeatherDecision[] => {
  const next = nextHours(hourly, 12);
  const decisions: WeatherDecision[] = [];

  const rainiest = pickMostSignificantPrecipitation(next);
  if (rainiest && (rainiest.pop >= 0.5 || (rainiest.precipitationMm ?? 0) >= 0.8)) {
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
  const maxWind = Math.max(weather.windSpeed, strongestWind ? effectiveWind(strongestWind) : 0);
  if (maxWind >= 9) {
    const forecastDominates = strongestWind && effectiveWind(strongestWind) >= weather.windSpeed;
    const displayedWind = forecastDominates
      ? Math.max(strongestWind.windSpeed ?? 0, strongestWind.windGust ?? 0)
      : weather.windSpeed;
    decisions.push({
      kind: 'wind',
      severity: maxWind >= 16 ? 'high' : 'moderate',
      time: forecastDominates ? strongestWind.time : undefined,
      value: displayedWind,
    });
  }

  const hottest = next.reduce<HourlyForecast | undefined>((best, point) => {
    const apparent = point.apparentTemperature ?? point.temp;
    const bestApparent = best ? (best.apparentTemperature ?? best.temp) : -Infinity;
    return !best || apparent > bestApparent ? point : best;
  }, undefined);
  const maxTemperature = Math.max(
    weather.feelsLike,
    hottest ? (hottest.apparentTemperature ?? hottest.temp) : -Infinity
  );
  if (maxTemperature >= 32) {
    decisions.push({
      kind: 'heat',
      severity: maxTemperature >= 40 ? 'high' : 'moderate',
      time: hottest?.time,
      value: maxTemperature,
    });
  }

  const coldest = next.reduce<HourlyForecast | undefined>((best, point) => {
    const apparent = point.apparentTemperature ?? point.temp;
    const bestApparent = best ? (best.apparentTemperature ?? best.temp) : Infinity;
    return !best || apparent < bestApparent ? point : best;
  }, undefined);
  const minTemperature = Math.min(
    weather.feelsLike,
    coldest ? (coldest.apparentTemperature ?? coldest.temp) : Infinity
  );
  if (minTemperature <= 0) {
    decisions.push({
      kind: 'cold',
      severity: minTemperature <= -10 ? 'high' : 'moderate',
      time: coldest?.time,
      value: minTemperature,
    });
  }

  if (airQuality && airQuality.aqi >= 4) {
    decisions.push({
      kind: 'air-quality',
      severity: airQuality.aqi >= 5 ? 'high' : 'moderate',
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
  if (outdoor && outdoor.result.score >= 85) {
    decisions.push({
      kind: 'outdoor-window',
      severity: 'info',
      time: outdoor.point.time,
      value: outdoor.point.apparentTemperature ?? outdoor.point.temp,
    });
  }

  if (decisions.length === 0) decisions.push({ kind: 'stable', severity: 'info' });

  return decisions.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]).slice(0, 3);
};
