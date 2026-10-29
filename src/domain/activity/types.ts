import type { ScoreRange } from '../decision/aggregateHorizon';
import type { WindowExplanation } from '../decision/explain';
import type { PlanGateReason, WeatherTolerance } from '../plan/types';
import type {
  BestWindowRange,
  DecisionReasonCode,
  Hava81ScoreBand,
  ScoredWeatherWindow,
} from '../decision/types';

export type ActivityKind =
  | 'walk'
  | 'run'
  | 'bike'
  | 'dog'
  | 'picnic'
  | 'children'
  | 'beach'
  | 'garden'
  | 'motorcycle'
  | 'laundry';
export type TemperatureSensitivity = 'cold' | 'balanced' | 'heat';

export interface DecisionProfile {
  activities: ActivityKind[];
  temperatureSensitivity: TemperatureSensitivity;
  commuteStart?: string;
  commuteEnd?: string;
  activityStart?: string;
  activityEnd?: string;
  /** Comfort tolerance; "normal" when absent. Never changes safety limits. */
  windTolerance?: WeatherTolerance;
  rainTolerance?: WeatherTolerance;
  /** Seasonal pollen is scored only when the user says they react to it. */
  pollenAllergy?: boolean;
}

export interface ActivityWindowScore extends ScoredWeatherWindow {
  activity: ActivityKind;
  baselineScore: number;
  activityReasons: DecisionReasonCode[];
  /** Whether this hour may be recommended for the activity (daylight, limits, safety). */
  eligible?: boolean;
  gateReasons?: PlanGateReason[];
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
  /** Average score across the whole activity duration of the best window, when one fits. */
  bestWindowScore?: number;
  /** Up to two further non-overlapping windows that fit the whole activity, best first. */
  alternativeWindows: BestWindowRange<ActivityWindowScore>[];
  /** Even day: the whole near-best stretch around the best block ("any time 12:00–16:00"). */
  suitableSpan?: BestWindowRange<ActivityWindowScore>;
  /** The recommended block includes hours after dark. */
  inDarkness?: boolean;
  /** Most usable hours score alike; `weakSlots` are the clearly weaker ones. */
  evenDay?: { weakSlots: ActivityWindowScore[] };
  /** How long the activity is planned for (profile default). */
  durationMinutes: number;
  /** Why the best window wins over the other usable hours; absent when the day is even. */
  explanation?: WindowExplanation;
  /** Wet / dry headline when open rain chances move the score by at least 8 points. */
  scoreRange?: ScoreRange;
  slots: ActivityWindowScore[];
  reasons: DecisionReasonCode[];
}
