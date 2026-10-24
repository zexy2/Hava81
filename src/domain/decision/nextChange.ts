import type { HourlyForecast } from '../../types';

export type NextChangeKind = 'rainStarts' | 'rainStops' | 'warmer' | 'cooler' | 'steady' | 'unavailable';

export interface NextChange {
  kind: NextChangeKind;
  /** Forecast hour where the change starts; null when steady. */
  time: Date | null;
  /** Temperature at that hour (°C), for warmer/cooler. */
  temp: number | null;
}

const RAIN_POP = 0.4;
const TEMP_STEP = 3;

/** Use either valid forecast signal; missing/invalid rain evidence stays unknown. */
const rainStateForHour = (hour: HourlyForecast): boolean | undefined => {
  const hasValidProbability =
    Number.isFinite(hour.pop) && hour.pop >= 0 && hour.pop <= 1;
  const hasValidAmount =
    Number.isFinite(hour.precipitationMm) && (hour.precipitationMm as number) >= 0;
  if (!hasValidProbability && !hasValidAmount) return undefined;

  return (
    (hasValidProbability && hour.pop >= RAIN_POP) ||
    (hasValidAmount && (hour.precipitationMm as number) > 0)
  );
};

/**
 * Faz 2.2: one plain "what changes next" sentence for the first screen.
 * Looks at the next 24 forecast hours after `now` and returns the first
 * meaningful change: rain starting/stopping, or a ≥3° swing from now.
 */
export function getNextChange(
  hourly: HourlyForecast[],
  currentTemp: number,
  now: Date = new Date(),
  currentWet?: boolean
): NextChange {
  const nowMs = now.getTime();
  const horizonEnd = nowMs + 24 * 60 * 60 * 1000;
  const upcoming = hourly
    .filter(
      hour =>
        hour.time instanceof Date &&
        Number.isFinite(hour.time.getTime()) &&
        hour.time.getTime() > nowMs &&
        hour.time.getTime() < horizonEnd
    )
    .sort((a, b) => a.time.getTime() - b.time.getTime())
    .slice(0, 24);
  if (upcoming.length === 0) return { kind: 'unavailable', time: null, temp: null };
  // If a fresh current observation is available, compare the first forecast slot to it.
  // Otherwise establish a baseline from the first forecast slot with valid probability or
  // amount evidence; never treat missing/invalid signals as a dry hour.
  let previousWet = currentWet;
  for (const hour of upcoming) {
    const wet = rainStateForHour(hour);
    if (wet !== undefined && previousWet !== undefined && wet !== previousWet) {
      return { kind: wet ? 'rainStarts' : 'rainStops', time: hour.time, temp: hour.temp };
    }
    if (wet !== undefined) previousWet = wet;
    if (hour.temp - currentTemp >= TEMP_STEP)
      return { kind: 'warmer', time: hour.time, temp: hour.temp };
    if (currentTemp - hour.temp >= TEMP_STEP)
      return { kind: 'cooler', time: hour.time, temp: hour.temp };
  }
  return { kind: 'steady', time: null, temp: null };
}
