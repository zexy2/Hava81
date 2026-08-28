import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../types';

export type WeatherDecisionKind =
  'rain' | 'wind' | 'heat' | 'cold' | 'air-quality' | 'uv' | 'outdoor-window' | 'stable';

export type WeatherDecisionSeverity = 'info' | 'moderate' | 'high';

export interface WeatherDecision {
  kind: WeatherDecisionKind;
  severity: WeatherDecisionSeverity;
  time?: Date;
  value?: number;
}

export interface WeatherDecisionInput {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  uvIndexMax?: number;
}

const severityRank: Record<WeatherDecisionSeverity, number> = { high: 3, moderate: 2, info: 1 };

export const getWeatherDecisions = ({
  weather,
  hourly,
  airQuality,
  uvIndexMax,
}: WeatherDecisionInput): WeatherDecision[] => {
  const next = hourly.slice(0, 8);
  const decisions: WeatherDecision[] = [];

  const rainy = next.find(point => point.pop >= 0.5);
  if (rainy) {
    decisions.push({
      kind: 'rain',
      severity: rainy.pop >= 0.75 ? 'high' : 'moderate',
      time: rainy.time,
      value: rainy.pop,
    });
  }

  const strongestWind = next.reduce<HourlyForecast | undefined>((best, point) => {
    const speed = point.windSpeed ?? 0;
    return !best || speed > (best.windSpeed ?? 0) ? point : best;
  }, undefined);
  const maxWind = Math.max(weather.windSpeed, strongestWind?.windSpeed ?? 0);
  if (maxWind >= 10.8) {
    decisions.push({
      kind: 'wind',
      severity: maxWind >= 17.2 ? 'high' : 'moderate',
      time:
        strongestWind && (strongestWind.windSpeed ?? 0) >= weather.windSpeed
          ? strongestWind.time
          : undefined,
      value: maxWind,
    });
  }

  const hottest = next.reduce<HourlyForecast | undefined>(
    (best, point) => (!best || point.temp > best.temp ? point : best),
    undefined
  );
  const maxTemperature = Math.max(weather.tempMax, weather.temperature, hottest?.temp ?? -Infinity);
  if (maxTemperature >= 32) {
    decisions.push({
      kind: 'heat',
      severity: maxTemperature >= 38 ? 'high' : 'moderate',
      time: hottest?.time,
      value: maxTemperature,
    });
  }

  const coldest = next.reduce<HourlyForecast | undefined>(
    (best, point) => (!best || point.temp < best.temp ? point : best),
    undefined
  );
  const minTemperature = Math.min(weather.tempMin, weather.temperature, coldest?.temp ?? Infinity);
  if (minTemperature <= 0) {
    decisions.push({
      kind: 'cold',
      severity: minTemperature <= -5 ? 'high' : 'moderate',
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

  if (uvIndexMax !== undefined && uvIndexMax >= 6) {
    decisions.push({
      kind: 'uv',
      severity: uvIndexMax >= 8 ? 'high' : 'moderate',
      value: uvIndexMax,
    });
  }

  const outdoor = next.find(
    point => point.pop < 0.25 && (point.windSpeed ?? 0) < 8 && point.temp >= 12 && point.temp <= 28
  );
  if (outdoor) {
    decisions.push({
      kind: 'outdoor-window',
      severity: 'info',
      time: outdoor.time,
      value: outdoor.temp,
    });
  }

  if (decisions.length === 0) {
    decisions.push({ kind: 'stable', severity: 'info' });
  }

  return decisions.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]).slice(0, 3);
};
