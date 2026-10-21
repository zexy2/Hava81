import type { HourlyForecast } from '../../types';

export type NextChangeKind = 'rainStarts' | 'rainStops' | 'warmer' | 'cooler' | 'steady';

export interface NextChange {
  kind: NextChangeKind;
  /** Forecast hour where the change starts; null when steady. */
  time: Date | null;
  /** Temperature at that hour (°C), for warmer/cooler. */
  temp: number | null;
}

const RAIN_POP = 0.4;
const TEMP_STEP = 3;

/**
 * Faz 2.2: one plain "what changes next" sentence for the first screen.
 * Looks at the next 24 forecast hours after `now` and returns the first
 * meaningful change: rain starting/stopping, or a ≥3° swing from now.
 */
export function getNextChange(
  hourly: HourlyForecast[],
  currentTemp: number,
  now: Date = new Date()
): NextChange {
  const upcoming = hourly.filter(hour => hour.time.getTime() > now.getTime()).slice(0, 24);
  if (upcoming.length === 0) return { kind: 'steady', time: null, temp: null };
  const wetNow = upcoming[0].pop >= RAIN_POP;
  for (const hour of upcoming) {
    const wet = hour.pop >= RAIN_POP;
    if (wet !== wetNow) {
      return { kind: wet ? 'rainStarts' : 'rainStops', time: hour.time, temp: hour.temp };
    }
    if (hour.temp - currentTemp >= TEMP_STEP)
      return { kind: 'warmer', time: hour.time, temp: hour.temp };
    if (currentTemp - hour.temp >= TEMP_STEP)
      return { kind: 'cooler', time: hour.time, temp: hour.temp };
  }
  return { kind: 'steady', time: null, temp: null };
}
