export type DecisionReasonCode =
  | "extreme-heat"
  | "heat"
  | "freezing"
  | "cold"
  | "heavy-rain"
  | "rain-risk"
  | "strong-wind"
  | "windy"
  | "gusty-wind"
  | "poor-air-quality"
  | "sensitive-air-quality"
  | "high-uv"
  | "low-visibility"
  | "severe-weather";

export type Hava81ScoreBand = "excellent" | "good" | "caution" | "difficult";

export type Hava81ScoreFactor =
  | "thermal"
  | "precipitation"
  | "wind"
  | "air-quality"
  | "uv"
  | "visibility"
  | "severe-weather"
  | "compound";

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
  precipitationProbability: number;
  precipitationMm?: number;
  windSpeed: number;
  windGust?: number;
  humidity?: number;
  uvIndex?: number;
  visibility?: number;
  weatherCode?: number;
  reasons: DecisionReasonCode[];
  impacts: ScoreFactorImpact[];
}

export interface BestWindowRange<T extends ScoredWeatherWindow = ScoredWeatherWindow> {
  start: T;
  end: T;
  peak: T;
  tolerance: number;
}

export type UmbrellaAdvice = "yes" | "maybe" | "no";
export type WindAdvice = "strong" | "caution" | "normal";
export type AirQualityAdvice = "poor" | "sensitive" | "good" | "unknown";
export type ScoreConfidence = "high" | "medium" | "basic";

export interface NowOrLaterAdvice {
  kind: "now" | "later" | "similar";
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
}
