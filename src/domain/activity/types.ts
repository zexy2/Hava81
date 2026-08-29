import type { BestWindowRange, DecisionReasonCode, Hava81ScoreBand, ScoredWeatherWindow } from '../decision/types';

export type ActivityKind = 'walk' | 'run' | 'picnic' | 'children' | 'motorcycle' | 'laundry';
export type TemperatureSensitivity = 'cold' | 'balanced' | 'heat';

export interface DecisionProfile {
  activities: ActivityKind[];
  temperatureSensitivity: TemperatureSensitivity;
  commuteStart?: string;
  commuteEnd?: string;
  activityStart?: string;
  activityEnd?: string;
}

export interface ActivityWindowScore extends ScoredWeatherWindow {
  activity: ActivityKind;
  baselineScore: number;
  activityReasons: DecisionReasonCode[];
}

export interface ActivityPlan {
  activity: ActivityKind;
  score: number;
  baselineScore: number;
  activityImpact: number;
  windowApplied?: { start: string; end: string };
  windowUnavailable?: boolean;
  band: Hava81ScoreBand;
  bestWindow?: ActivityWindowScore;
  bestWindowRange?: BestWindowRange<ActivityWindowScore>;
  slots: ActivityWindowScore[];
  reasons: DecisionReasonCode[];
}
