export const OPENWEATHER_AQI_LABEL_KEYS = [
  'airQuality.good',
  'airQuality.fair',
  'airQuality.moderate',
  'airQuality.poor',
  'airQuality.veryPoor',
] as const;

export type OpenWeatherAqiLabelKey = (typeof OPENWEATHER_AQI_LABEL_KEYS)[number];

export function getOpenWeatherAqiLabelKey(aqi: number): OpenWeatherAqiLabelKey | undefined {
  if (!Number.isInteger(aqi) || aqi < 1 || aqi > OPENWEATHER_AQI_LABEL_KEYS.length) {
    return undefined;
  }

  return OPENWEATHER_AQI_LABEL_KEYS[aqi - 1];
}
