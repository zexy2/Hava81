/** Defensive ingestion ceiling shared with the serialized hourly-AQI parser.
 * European AQI's top category is open-ended (80+); this is a payload sanity limit,
 * not a new upper category threshold.
 */
export const MAX_EUROPEAN_AQI = 1_000;

export const OPENWEATHER_AQI_LABEL_KEYS = [
  'airQuality.good',
  'airQuality.fair',
  'airQuality.moderate',
  'airQuality.poor',
  'airQuality.veryPoor',
] as const;

export type OpenWeatherAqiLabelKey = (typeof OPENWEATHER_AQI_LABEL_KEYS)[number];

/** Normalize Open-Meteo European AQI (0–100+, open-ended) to the app's 1–5 risk scale. */
export function europeanAqiToOpenWeatherIndex(aqi: number): number | undefined {
  if (!Number.isFinite(aqi) || aqi < 0 || aqi > MAX_EUROPEAN_AQI) return undefined;
  if (aqi < 20) return 1;
  if (aqi < 40) return 2;
  if (aqi < 60) return 3;
  if (aqi < 80) return 4;
  return 5;
}

export function getOpenWeatherAqiLabelKey(aqi: number): OpenWeatherAqiLabelKey | undefined {
  if (!Number.isInteger(aqi) || aqi < 1 || aqi > OPENWEATHER_AQI_LABEL_KEYS.length) {
    return undefined;
  }

  return OPENWEATHER_AQI_LABEL_KEYS[aqi - 1];
}
