import type { HourlyForecast, NormalizedWeatherData } from '../../types';

/**
 * What the living sky should show: derived only from the current observation and the hour in
 * progress, so the background never contradicts the numbers on top of it.
 */
export type SkyCondition = 'clear' | 'partly' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';
export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface SkyScene {
  condition: SkyCondition;
  phase: SkyPhase;
  /** 0–1 cloud cover. */
  cloudCover: number;
  /** 0–1 precipitation intensity (drives drop / flake density). */
  intensity: number;
  /** Wind in m/s (drives cloud drift and rain slant). */
  windSpeed: number;
  /** Sunrise and sunset (epoch ms), so the sky can follow the sun minute by minute. */
  sunrise: number;
  sunset: number;
}

export interface SunPosition {
  /** −1 (deep night) … 0 (on the horizon) … 1 (solar noon). */
  elevation: number;
  /** 0 = east (morning) … 1 = west (evening). */
  azimuth: number;
}

const DAY_MS = 86_400_000;
/** How long after sunset (and before sunrise) the sky takes to reach full night. */
const NIGHT_FALL_MS = 100 * 60_000;

/**
 * The sun's place in the sky from the location's own sunrise and sunset: a smooth arc that
 * peaks at solar noon, and below the horizon a fall to full night over ~100 minutes. Without
 * valid times it falls back to a mid-day or night sun.
 */
export const sunAt = (
  now: number,
  sunrise: number,
  sunset: number,
  isNight = false
): SunPosition => {
  if (!Number.isFinite(sunrise) || !Number.isFinite(sunset) || sunrise >= sunset) {
    return { elevation: isNight ? -0.6 : 0.6, azimuth: 0.5 };
  }
  if (now >= sunrise && now <= sunset) {
    const progress = (now - sunrise) / (sunset - sunrise);
    return { elevation: Math.sin(Math.PI * progress), azimuth: progress };
  }
  // Below the horizon: measure from whichever is nearer, the last sunset or the next sunrise.
  const sinceSunset = now > sunset ? now - sunset : now - (sunset - DAY_MS);
  const untilSunrise = now < sunrise ? sunrise - now : sunrise + DAY_MS - now;
  const evening = sinceSunset < untilSunrise;
  const distance = Math.min(sinceSunset, untilSunrise);
  return { elevation: -Math.min(1, distance / NIGHT_FALL_MS), azimuth: evening ? 1 : 0 };
};

const HOUR_MS = 3_600_000;
/** How long dawn / dusk light lasts around sunrise and sunset. */
const TWILIGHT_MS = 45 * 60_000;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const skyPhaseAt = (
  now: number,
  sunrise: Date,
  sunset: Date,
  isNight: boolean
): SkyPhase => {
  const rise = sunrise.getTime();
  const set = sunset.getTime();
  if (Number.isFinite(rise) && Number.isFinite(set) && rise < set) {
    if (Math.abs(now - rise) <= TWILIGHT_MS) return 'dawn';
    if (Math.abs(now - set) <= TWILIGHT_MS) return 'dusk';
    return now > rise && now < set ? 'day' : 'night';
  }
  return isNight ? 'night' : 'day';
};

const conditionOf = (icon: string, visibility?: number): SkyCondition => {
  const family = icon.slice(0, 2);
  if (family === '11') return 'storm';
  if (family === '09' || family === '10') return 'rain';
  if (family === '13') return 'snow';
  if (family === '50' || (Number.isFinite(visibility) && (visibility as number) < 1000))
    return 'fog';
  if (family === '04') return 'cloudy';
  if (family === '02' || family === '03') return 'partly';
  return 'clear';
};

/** The forecast step in progress, if any. */
const currentHour = (hourly: readonly HourlyForecast[], now: number) =>
  [...hourly]
    .filter(point => point.time instanceof Date && Number.isFinite(point.time.getTime()))
    .sort((a, b) => a.time.getTime() - b.time.getTime())
    .find(point => point.time.getTime() <= now && now < point.time.getTime() + HOUR_MS);

export const resolveSkyScene = (
  weather: NormalizedWeatherData,
  hourly: readonly HourlyForecast[] = [],
  now = Date.now()
): SkyScene => {
  const condition = conditionOf(weather.icon, weather.visibility);
  const hour = currentHour(hourly, now);
  const mm = hour?.precipitationMm;
  const pop = hour?.pop;
  const wet = condition === 'rain' || condition === 'storm' || condition === 'snow';
  // Intensity from the measured amount when known (≈ 4 mm/h is heavy), else a moderate default.
  const intensity = wet
    ? Number.isFinite(mm)
      ? clamp01(0.25 + (mm as number) / 4)
      : Number.isFinite(pop)
        ? clamp01(0.3 + (pop as number) * 0.4)
        : 0.5
    : 0;
  const cloudCover = clamp01(
    Number.isFinite(weather.clouds)
      ? weather.clouds / 100
      : condition === 'clear'
        ? 0.05
        : condition === 'partly'
          ? 0.4
          : 0.85
  );
  return {
    condition,
    phase: skyPhaseAt(now, weather.sunrise, weather.sunset, weather.icon.endsWith('n')),
    cloudCover: wet || condition === 'fog' ? Math.max(cloudCover, 0.75) : cloudCover,
    intensity,
    windSpeed: Number.isFinite(weather.windSpeed) ? Math.max(0, weather.windSpeed) : 2,
    sunrise: weather.sunrise instanceof Date ? weather.sunrise.getTime() : Number.NaN,
    sunset: weather.sunset instanceof Date ? weather.sunset.getTime() : Number.NaN,
  };
};
