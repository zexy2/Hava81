import type { DecisionReasonCode, Hava81ScoreBand, ScoredWeatherWindow } from '../decision/types';

export type ActivityKind = 'walk' | 'run' | 'picnic' | 'children' | 'motorcycle' | 'laundry';
export type TemperatureSensitivity = 'cold' | 'balanced' | 'heat';

export interface DecisionProfile {
  activities: ActivityKind[];
  temperatureSensitivity: TemperatureSensitivity;
  commuteStart?: string;
  commuteEnd?: string;
}

export interface ActivityWindowScore extends ScoredWeatherWindow {
  activity: ActivityKind;
  activityReasons: DecisionReasonCode[];
}

export interface ActivityPlan {
  activity: ActivityKind;
  score: number;
  band: Hava81ScoreBand;
  bestWindow?: ActivityWindowScore;
  slots: ActivityWindowScore[];
  reasons: DecisionReasonCode[];
}
