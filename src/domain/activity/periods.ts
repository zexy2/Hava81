import type { ActivityPlan } from './types';

export type PlanPeriodId = 'now' | 'evening' | 'tomorrow' | 'weekend';
export const PLAN_PERIODS: readonly PlanPeriodId[] = ['now', 'evening', 'tomorrow', 'weekend'];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * The asked period in the city's local time, as UTC milliseconds. "now" is the default 12-hour
 * look-ahead (undefined). A period that has already ended today ("evening" after 23:00) is null.
 */
export function resolvePlanPeriod(
  id: PlanPeriodId,
  nowMs: number,
  timezoneOffsetSeconds: number
): { startMs: number; endMs: number } | null | undefined {
  if (id === 'now') return undefined;
  const offsetMs = timezoneOffsetSeconds * 1000;
  const localNow = nowMs + offsetMs;
  const localMidnight = Math.floor(localNow / DAY_MS) * DAY_MS;
  // Local wall-clock time → UTC instant.
  const at = (dayOffset: number, hour: number) =>
    localMidnight + dayOffset * DAY_MS + hour * HOUR_MS - offsetMs;
  const clip = (startMs: number, endMs: number) =>
    endMs <= nowMs ? null : { startMs: Math.max(startMs, nowMs), endMs };

  if (id === 'evening') return clip(at(0, 17), at(0, 23));
  if (id === 'tomorrow') return clip(at(1, 7), at(1, 22));
  // 0 = Sunday … 6 = Saturday, in local time.
  const weekday = new Date(localMidnight).getUTCDay();
  if (weekday === 0) return clip(at(0, 7), at(0, 22));
  const toSaturday = 6 - weekday;
  return clip(at(toSaturday, 7), at(toSaturday + 1, 22));
}

/**
 * "What should I do?": activities ordered by their best window in the period. Plans without a
 * recommendable window go last, kept so the page can say when they would work instead.
 */
export function rankActivityPlans(plans: readonly ActivityPlan[]): ActivityPlan[] {
  const usable = (plan: ActivityPlan) => !plan.windowUnavailable && plan.bestWindowRange;
  return [...plans].sort((a, b) => {
    const ua = usable(a) ? 1 : 0;
    const ub = usable(b) ? 1 : 0;
    if (ua !== ub) return ub - ua;
    return b.score - a.score;
  });
}
