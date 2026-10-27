import type { DailyForecast } from '../../types';

export type DailyWeatherRiskKind = 'storm' | 'heavy-rain';
export type DailyWeatherRiskSeverity = 'warning' | 'severe';

export interface DailyWeatherRisk {
  date: Date;
  kind: DailyWeatherRiskKind;
  /** 0–1 ratio. */
  pop: number;
  mm: number;
  severity: DailyWeatherRiskSeverity;
}

const DAY_MS = 86_400_000;
const HORIZON_DAYS = 5;

/** Daily rows carry OpenWeather-style icons; `11d`/`11n` is thunderstorm. */
const isThunderstorm = (day: DailyForecast & { weatherCode?: number }): boolean =>
  /^11[dn]?$/.test(day.icon ?? '') ||
  (typeof day.weatherCode === 'number' &&
    ((day.weatherCode >= 95 && day.weatherCode <= 99) ||
      (day.weatherCode >= 200 && day.weatherCode < 300)));

const finite = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;

/** Classifies one day; null when it carries no severe-weather risk. */
export const classifyDailyRisk = (day: DailyForecast): DailyWeatherRisk | null => {
  const pop = Math.min(1, finite(day.pop));
  const mm = finite(day.precipitationMm);
  const storm = isThunderstorm(day);
  const heavy = (pop >= 0.7 && mm >= 20) || mm >= 40;
  if (!storm && !heavy) return null;
  const severe = (storm && mm >= 20) || mm >= 40;
  return {
    date: day.date,
    kind: storm ? 'storm' : 'heavy-rain',
    pop,
    mm,
    severity: severe ? 'severe' : 'warning',
  };
};

/** First day (today or later, within the 5-day horizon) carrying a weather risk. */
export const findDailyWeatherRisk = (
  daily: readonly DailyForecast[] | undefined,
  now: Date | number
): DailyWeatherRisk | null => {
  if (!daily?.length) return null;
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const upcoming = daily
    .filter(day => day.date instanceof Date && day.date.getTime() + DAY_MS > nowMs)
    .slice(0, HORIZON_DAYS);
  for (const day of upcoming) {
    const risk = classifyDailyRisk(day);
    if (risk) return risk;
  }
  return null;
};
