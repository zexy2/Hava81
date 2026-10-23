/**
 * Plan v3 Faz 0.4 — one set of decision thresholds.
 *
 * The day plan (Gün planı), the Today headline (Bugün başlığı / weatherDecisions), the commute
 * plan (Çıkış planı) and the score's reason codes all read these values, so the same hour can
 * never be "take an umbrella" on one card and "no umbrella needed" on another (L8).
 * Personal temperature sensitivity may shift the heat/cold values per user (commute), but the
 * base values live here only.
 */

/** Umbrella / rain. Probabilities are 0–1 ratios, amounts mm per hour. */
export const RAIN_LIKELY_PROBABILITY = 0.5;
export const RAIN_LIKELY_MM = 1;
export const RAIN_POSSIBLE_PROBABILITY = 0.25;
export const RAIN_POSSIBLE_MM = 0.2;

/** Wind in m/s: sustained speed or gust. */
export const WIND_STRONG_SPEED = 13;
export const WIND_STRONG_GUST = 20;
export const WIND_CAUTION_SPEED = 8;
export const WIND_CAUTION_GUST = 13;

/** Feels-like temperature in °C. */
export const HEAT_APPARENT_C = 30;
export const EXTREME_HEAT_APPARENT_C = 38;
export const COLD_APPARENT_C = 7;
export const FREEZING_APPARENT_C = 0;

/** OpenWeather AQI scale 1–5. */
export const AQI_SENSITIVE = 3;
export const AQI_POOR = 4;
export const AQI_VERY_POOR = 5;

export type RainLevel = 'likely' | 'possible' | 'none';
export type WindLevel = 'strong' | 'caution' | 'normal';
export type AirLevel = 'very-poor' | 'poor' | 'sensitive' | 'fine';

const finite = (value: number | undefined): value is number => Number.isFinite(value);

/** `undefined` when neither probability nor amount is known. */
export const rainLevel = (probability?: number, amountMm?: number): RainLevel | undefined => {
  if (!finite(probability) && !finite(amountMm)) return undefined;
  const pop = finite(probability) ? probability : 0;
  const mm = finite(amountMm) ? amountMm : 0;
  if (mm >= RAIN_LIKELY_MM || pop >= RAIN_LIKELY_PROBABILITY) return 'likely';
  if (mm >= RAIN_POSSIBLE_MM || pop >= RAIN_POSSIBLE_PROBABILITY) return 'possible';
  return 'none';
};

export const windLevel = (speed: number, gust?: number): WindLevel => {
  const gustValue = finite(gust) ? gust : 0;
  if (speed >= WIND_STRONG_SPEED || gustValue >= WIND_STRONG_GUST) return 'strong';
  if (speed >= WIND_CAUTION_SPEED || gustValue >= WIND_CAUTION_GUST) return 'caution';
  return 'normal';
};

/**
 * OpenWeather AQI is an ordinal 1–5 category, not a pollutant concentration or a 0–100 score.
 * Invalid/out-of-range values are unavailable; never clamp them into a plausible-looking label.
 */
export const airLevel = (aqi?: number): AirLevel | undefined => {
  if (!finite(aqi) || !Number.isInteger(aqi) || aqi < 1 || aqi > 5) return undefined;
  if (aqi >= AQI_VERY_POOR) return 'very-poor';
  if (aqi >= AQI_POOR) return 'poor';
  if (aqi >= AQI_SENSITIVE) return 'sensitive';
  return 'fine';
};

export type EuropeanAqiLevel =
  | 'good'
  | 'fair'
  | 'moderate'
  | 'poor'
  | 'very-poor'
  | 'extremely-poor';

/**
 * Open-Meteo European AQI uses a separate 0–100+ scale. Keep it separate from airLevel()
 * so a European AQI value can never be mistaken for OpenWeather's 1–5 ordinal index.
 */
export const europeanAqiLevel = (aqi?: number): EuropeanAqiLevel | undefined => {
  if (!finite(aqi) || aqi < 0 || aqi > 1_000) return undefined;
  if (aqi <= 20) return 'good';
  if (aqi <= 40) return 'fair';
  if (aqi <= 60) return 'moderate';
  if (aqi <= 80) return 'poor';
  if (aqi <= 100) return 'very-poor';
  return 'extremely-poor';
};

const windRank: Record<WindLevel, number> = { normal: 0, caution: 1, strong: 2 };

/** The worse of two wind levels. */
export const worseWind = (a: WindLevel, b: WindLevel): WindLevel =>
  windRank[a] >= windRank[b] ? a : b;
