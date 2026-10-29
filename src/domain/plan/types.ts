import type { DecisionReasonCode, Hava81ScoreBand } from '../decision/types';

export type PlanIntent =
  | 'walk'
  | 'run'
  | 'bike'
  | 'dog'
  | 'picnic'
  | 'children'
  | 'beach'
  | 'garden'
  | 'laundry'
  | 'motorcycle';
export type PlanConfidence = 'high' | 'medium' | 'low';
export type PlanFactor =
  | 'thermal'
  | 'precipitation'
  | 'wind'
  | 'air-quality'
  | 'uv'
  | 'visibility'
  | 'severe-weather'
  | 'compound';

export interface PlanProfile {
  intent: PlanIntent;
  durationMinutes: number;
  /** Apparent-temperature range with no comfort penalty for this intent. */
  comfortRangeC: readonly [number, number];
  weights: Readonly<Record<PlanFactor, number>>;
  /** Gate limits are the largest allowed value: a slot is gated when it goes above them. */
  maxWindSpeedMs: number;
  maxWindGustMs: number;
  maxPrecipitationProbability: number;
  maxPrecipitationMm: number;
  requiresDaylight: boolean;
  activeHoursOnly: boolean;
  /**
   * The plan is only about rain (laundry, picnic): an hour with unknown precipitation cannot be
   * recommended and stays out of the good band.
   */
  requiresRainEvidence?: boolean;
  /** Heat helps rather than hurts (drying laundry): only cold stress and the range count. */
  heatIsBeneficial?: boolean;
  /**
   * Drying plan (laundry): scored by drying power — vapour-pressure deficit from temperature and
   * dew point (relative humidity as fallback) and sunshine — instead of human comfort.
   */
  dryingModel?: boolean;
  /**
   * Sea plan (beach, swimming): needs the marine context; water temperature and wave height add
   * a penalty and gate the hour, and a city without marine data cannot recommend it.
   */
  seaModel?: boolean;
  /** Exertion plans feel a high dew point beyond apparent temperature (running). 0–1. */
  mugginessWeight?: number;
  /** Breathing-heavy plans react to Saharan dust (daily peak, µg/m³). 0–1. */
  dustWeight?: number;
  /** Outdoor-air plans where pollen matters to an allergic person. 0–1. */
  pollenWeight?: number;
}

export type PlanTemperatureSensitivity = 'cold' | 'balanced' | 'heat';

/** Personal comfort tolerance: re-weights comfort only, never safety caps or gates. */
export type WeatherTolerance = 'low' | 'normal' | 'high';

export interface PersonalTolerance {
  wind?: WeatherTolerance;
  rain?: WeatherTolerance;
  /** Seasonal pollen counts only for people who say they react to it. */
  pollenAllergy?: boolean;
}

export type PlanGateReason =
  | 'daylight-required'
  | 'outside-active-hours'
  | 'precipitation-limit'
  | 'precipitation-unknown'
  | 'wind-limit'
  | 'extreme-temperature'
  | 'heavy-precipitation'
  | 'extreme-wind'
  | 'very-poor-air-quality'
  | 'low-visibility'
  | 'severe-weather'
  | 'outside-availability'
  | 'sea-conditions'
  | 'invalid-weather-data';

export interface PlanPenalties {
  thermal: number;
  precipitation: number;
  wind: number;
  airQuality: number;
  uv: number;
  visibility: number;
  severeWeather: number;
  /** Intent-only penalties: laundry drying power, running mugginess. */
  drying: number;
  muggy: number;
  /** Saharan dust exposure for breathing-heavy intents. */
  dust: number;
  /** Pollen exposure, only with a declared allergy. */
  pollen: number;
  /** Sea plans: cold water and waves (marine context). */
  sea: number;
  compound: number;
  /** Comfort-range penalty is included in thermal. This field exposes its contribution. */
  comfort: number;
  total: number;
}

export interface PlanHourScore {
  intent: PlanIntent;
  time: Date;
  score: number;
  /** The general Hava81 score of the same hour, before intent weighting. */
  baseScore: number;
  band: Hava81ScoreBand;
  temperature: number;
  apparentTemperature: number;
  humidity?: number;
  precipitationProbability?: number;
  precipitationMm?: number;
  windSpeed: number;
  windGust?: number;
  airQualityIndex?: number;
  uvIndex?: number;
  visibility?: number;
  weatherCode?: number;
  reasons: DecisionReasonCode[];
  /** Reasons of the general score; `reasons` minus these are intent-specific. */
  baseReasons: DecisionReasonCode[];
  penalties: PlanPenalties;
  eligible: boolean;
  gateReasons: PlanGateReason[];
  confidence: PlanConfidence;
  forecastHoursAhead: number;
  dataCoverage: number;
}

export interface PlanAvailability {
  /** Local weekday numbers: Sunday = 0 through Saturday = 6. */
  weekdays?: readonly number[];
  /** Optional local clock range, 24-hour HH:mm. Overnight ranges are supported. */
  startTime?: string;
  endTime?: string;
}

export interface PlanWindow {
  start: Date;
  end: Date;
  score: number;
  band: Hava81ScoreBand;
  confidence: PlanConfidence;
  slots: PlanHourScore[];
  peak: PlanHourScore;
  reasons: DecisionReasonCode[];
}

export interface PlanSnapshot {
  intent: PlanIntent;
  durationMinutes: number;
  generatedAt: Date;
  hours: PlanHourScore[];
  windows: PlanWindow[];
  confidence: PlanConfidence;
  dataCoverage: number;
}
