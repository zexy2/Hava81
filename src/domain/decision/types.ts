import type { ScoreRange } from './aggregateHorizon';
import type { WindowExplanation } from './explain';
export type DecisionReasonCode =
  | 'extreme-heat'
  | 'heat'
  | 'freezing'
  | 'cold'
  | 'heavy-rain'
  | 'rain-risk'
  | 'strong-wind'
  | 'windy'
  | 'gusty-wind'
  | 'poor-air-quality'
  | 'sensitive-air-quality'
  | 'high-uv'
  | 'low-visibility'
  | 'severe-weather'
  | 'muggy'
  | 'dust'
  | 'pollen';

export type Hava81ScoreBand = 'excellent' | 'good' | 'caution' | 'difficult';

export type Hava81ScoreFactor =
  | 'thermal'
  | 'precipitation'
  | 'wind'
  | 'air-quality'
  | 'uv'
  | 'visibility'
  | 'severe-weather'
  | 'compound';

export interface ScoreFactorImpact {
  factor: Hava81ScoreFactor;
  penalty: number;
}

export interface ScoredWeatherWindow {
  time: Date;
  score: number;
  band: Hava81ScoreBand;
  temperature: number;
  apparentTemperature: number;
  precipitationProbability?: number;
  precipitationMm?: number;
  windSpeed: number;
  windGust?: number;
  humidity?: number;
  uvIndex?: number;
  visibility?: number;
  weatherCode?: number;
  reasons: DecisionReasonCode[];
  impacts: ScoreFactorImpact[];
  /** Unrounded penalty components, so intent scoring re-weights evidence, not display values. */
  penalties?: ScorePenaltyBreakdown;
}

export interface ScorePenaltyBreakdown {
  thermal: number;
  /** Gentle distance from the general 22 °C comfort centre (part of `thermal`). */
  thermalCentre: number;
  /** Heat or cold stress shared by every intent (part of `thermal`). */
  thermalStress: number;
  precipitation: number;
  wind: number;
  airQuality: number;
  uv: number;
  visibility: number;
  severeWeather: number;
  compound: number;
}

export interface BestWindowRange<T extends ScoredWeatherWindow = ScoredWeatherWindow> {
  start: T;
  /** Last slot inside the range; the range itself lasts until `endTime`. */
  end: T;
  /** When the last slot ends (its start plus the forecast cadence). Show this as the range end. */
  endTime: Date;
  peak: T;
  tolerance: number;
}

export type UmbrellaAdvice = 'yes' | 'maybe' | 'no' | 'unknown';
export type WindAdvice = 'strong' | 'caution' | 'normal';
export type AirQualityAdvice = 'poor' | 'sensitive' | 'fair' | 'good' | 'unknown';
export type ScoreConfidence = 'high' | 'medium' | 'basic';

export interface NowOrLaterAdvice {
  kind: 'now' | 'later' | 'similar';
  targetTime?: Date;
  improvement?: number;
  currentScore: number;
  targetScore: number;
  reasons: DecisionReasonCode[];
}

export interface DailyPlan {
  score: number;
  band: Hava81ScoreBand;
  slots: ScoredWeatherWindow[];
  bestWindow?: ScoredWeatherWindow;
  bestWindowRange?: BestWindowRange;
  umbrella: UmbrellaAdvice;
  wind: WindAdvice;
  airQuality: AirQualityAdvice;
  nowOrLater: NowOrLaterAdvice;
  impacts: ScoreFactorImpact[];
  confidence: ScoreConfidence;
  /** Why the best window wins over the other usable hours; absent when the day is even. */
  explanation?: WindowExplanation;
  /** Wet / dry headline when open rain chances move the score by at least 8 points. */
  scoreRange?: ScoreRange;
}
