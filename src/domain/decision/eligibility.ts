import type { ActivityKind } from '../activity/types';

/**
 * Plan v3 Faz 0.3 — which hours may be recommended at all.
 *
 * Owner decision (2026-10-22): picnic, children/park and laundry (and beach, later) never
 * recommend a dark hour; walking and running (and the general Hava81 day plan, which uses
 * the walking rule) only consider hours inside the 07–23 local window. Night hours still get
 * scored and shown on the timeline; they just cannot become "the best time".
 */

/** First local hour that may start a walk/run recommendation. */
export const ACTIVE_HOURS_START = 7;
/** Local hour at which walk/run recommendations stop (exclusive: the 22:00 slot is the last). */
export const ACTIVE_HOURS_END = 23;

const DAYLIGHT_ONLY: ReadonlySet<ActivityKind> = new Set<ActivityKind>([
  'picnic',
  'children',
  'laundry',
]);
const ACTIVE_HOURS_ONLY: ReadonlySet<ActivityKind> = new Set<ActivityKind>(['walk', 'run']);

/**
 * Daylight flag: API `isDay` first, then the icon's `d`/`n` suffix. Unknown is not daylight: a
 * daylight-only plan (picnic, laundry) must not be recommended on evidence we do not have.
 */
export const isDaylightPoint = (point: { isDay?: boolean; icon?: string }): boolean => {
  if (typeof point.isDay === 'boolean') return point.isDay;
  if (typeof point.icon === 'string' && /[dn]$/.test(point.icon)) return !point.icon.endsWith('n');
  return false;
};

export const localHourOf = (time: Date, timezoneOffsetSeconds: number): number =>
  new Date(time.getTime() + timezoneOffsetSeconds * 1000).getUTCHours();

export const isWithinActiveHours = (time: Date, timezoneOffsetSeconds: number): boolean => {
  const hour = localHourOf(time, timezoneOffsetSeconds);
  return hour >= ACTIVE_HOURS_START && hour < ACTIVE_HOURS_END;
};

export interface EligibilityPoint {
  time: Date;
  isDay?: boolean;
  icon?: string;
}

/**
 * `activity` undefined means the general day plan (Hava81 Skoru), which follows the walking
 * rule because walking is the default outdoor intent.
 */
export const isRecommendableHour = (
  point: EligibilityPoint,
  timezoneOffsetSeconds: number,
  activity?: ActivityKind
): boolean => {
  if (activity && DAYLIGHT_ONLY.has(activity)) return isDaylightPoint(point);
  if (!activity || ACTIVE_HOURS_ONLY.has(activity)) {
    return isWithinActiveHours(point.time, timezoneOffsetSeconds);
  }
  return true;
};
