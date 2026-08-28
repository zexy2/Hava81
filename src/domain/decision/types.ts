export type DecisionReasonCode =
  | 'extreme-heat'
  | 'heat'
  | 'freezing'
  | 'cold'
  | 'heavy-rain'
  | 'rain-risk'
  | 'strong-wind'
  | 'windy'
  | 'poor-air-quality'
  | 'sensitive-air-quality';

export type Hava81ScoreBand = 'excellent' | 'good' | 'caution' | 'difficult';

export interface ScoredWeatherWindow {
  time: Date;
  score: number;
  band: Hava81ScoreBand;
  temperature: number;
  precipitationProbability: number;
  windSpeed: number;
  reasons: DecisionReasonCode[];
}

export type UmbrellaAdvice = 'yes' | 'maybe' | 'no';
export type WindAdvice = 'strong' | 'caution' | 'normal';
export type AirQualityAdvice = 'poor' | 'sensitive' | 'good' | 'unknown';

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
  umbrella: UmbrellaAdvice;
  wind: WindAdvice;
  airQuality: AirQualityAdvice;
  nowOrLater: NowOrLaterAdvice;
}
