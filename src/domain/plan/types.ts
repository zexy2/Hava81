import type { DecisionReasonCode, Hava81ScoreBand } from '../decision/types';

export type PlanIntent = 'walk' | 'run' | 'bike' | 'picnic' | 'children' | 'laundry' | 'motorcycle';
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
  comfortRangeC: readonly [number, number];
  weights: Readonly<Record<PlanFactor, number>>;
  maxWindSpeedMs: number;
  maxWindGustMs: number;
  maxPrecipitationProbability: number;
  maxPrecipitationMm: number;
  requiresDaylight: boolean;
  activeHoursOnly: boolean;
}

export type PlanGateReason =
  | 'daylight-required'
  | 'outside-active-hours'
  | 'precipitation-limit'
  | 'wind-limit'
  | 'severe-weather'
  | 'outside-availability'
  | 'invalid-weather-data';

export interface PlanPenalties {
  thermal: number;
  precipitation: number;
  wind: number;
  airQuality: number;
  uv: number;
  visibility: number;
  severeWeather: number;
  compound: number;
  /** Comfort-range penalty is included in thermal. This field exposes its contribution. */
  comfort: number;
  total: number;
}

export interface PlanHourScore {
  intent: PlanIntent;
  time: Date;
  score: number;
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
