import { rainUncertainty } from './aggregateHorizon';
import type { BestWindowRange, ScoredWeatherWindow } from './types';

const DEFAULT_TOLERANCE = 3;
const DEFAULT_MAX_RANGE_HOURS = 4;
const HOUR_MS = 60 * 60 * 1000;

const median = (values: number[]) => {
  if (!values.length) return 60 * 60 * 1000;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
};

/**
 * Forecast scores are not precise enough to imply that one clock tick is uniquely best.
 * Group adjacent slots that remain within a small score distance of the peak so the UI can
 * communicate a useful near-best interval while retaining the peak slot for compatibility.
 */
export const findBestWindowRange = <T extends ScoredWeatherWindow>(
  slots: T[],
  tolerance = DEFAULT_TOLERANCE,
  isEligible: (slot: T) => boolean = () => true,
  /** Cap on the range length; an even day's "suitable stretch" lifts it. */
  maxRangeHours = DEFAULT_MAX_RANGE_HOURS
): BestWindowRange<T> | undefined => {
  if (!slots.length) return undefined;
  const ordered = [...slots].sort((a, b) => a.time.getTime() - b.time.getTime());
  // Ineligible hours (e.g. dark hours for a picnic, plan v3 Faz 0.3) can never be the peak
  // and also stop the range from growing across them.
  const candidates = ordered.filter(slot => isEligible(slot));
  if (!candidates.length) return undefined;
  // Equal scores: prefer the hour whose rain forecast is more decided, then the earlier one.
  const peak = candidates.reduce(
    (best, slot) =>
      slot.score > best.score ||
      (slot.score === best.score && rainUncertainty(slot) < rainUncertainty(best))
        ? slot
        : best,
    candidates[0]
  );
  const peakIndex = ordered.indexOf(peak);
  const positiveGaps = ordered
    .slice(1)
    .map((slot, index) => slot.time.getTime() - ordered[index].time.getTime())
    .filter(gap => gap > 0 && Number.isFinite(gap));
  const cadenceMs = median(positiveGaps);
  const maxAdjacentGapMs = cadenceMs * 1.6;
  const floor = peak.score - Math.max(0, tolerance);
  const peakReasons = new Set(peak.reasons);
  const isRiskCompatible = (candidate: T) =>
    isEligible(candidate) && candidate.reasons.every(reason => peakReasons.has(reason));

  const maxRangeMs = maxRangeHours * HOUR_MS;
  let startIndex = peakIndex;
  let endIndex = peakIndex;

  // A mathematically near-flat 12-hour period should not become an unhelpful 10–12 hour
  // recommendation. Grow around the peak while the neighboring point is still near-best,
  // contiguous, and keeps the covered interval (including the last slot) within four hours.
  while (true) {
    const left = startIndex > 0 ? ordered[startIndex - 1] : undefined;
    const right = endIndex < ordered.length - 1 ? ordered[endIndex + 1] : undefined;
    const leftGap = left
      ? ordered[startIndex].time.getTime() - left.time.getTime()
      : Number.POSITIVE_INFINITY;
    const rightGap = right
      ? right.time.getTime() - ordered[endIndex].time.getTime()
      : Number.POSITIVE_INFINITY;
    const canTakeLeft = Boolean(
      left &&
      left.score >= floor &&
      isRiskCompatible(left) &&
      leftGap <= maxAdjacentGapMs &&
      ordered[endIndex].time.getTime() + cadenceMs - left.time.getTime() <= maxRangeMs
    );
    const canTakeRight = Boolean(
      right &&
      right.score >= floor &&
      isRiskCompatible(right) &&
      rightGap <= maxAdjacentGapMs &&
      right.time.getTime() + cadenceMs - ordered[startIndex].time.getTime() <= maxRangeMs
    );

    if (!canTakeLeft && !canTakeRight) break;
    if (canTakeLeft && canTakeRight) {
      if ((right?.score ?? -1) > (left?.score ?? -1)) endIndex += 1;
      else startIndex -= 1;
    } else if (canTakeLeft) {
      startIndex -= 1;
    } else {
      endIndex += 1;
    }
  }

  // A slot describes its whole forecast step, so the range lasts until the last slot ends.
  const lastSlotMs = ordered[endIndex].time.getTime();
  const nextSlotMs = ordered[endIndex + 1]?.time.getTime();
  const lastSlotSpanMs =
    nextSlotMs !== undefined && nextSlotMs - lastSlotMs <= maxAdjacentGapMs
      ? nextSlotMs - lastSlotMs
      : cadenceMs;

  return {
    start: ordered[startIndex],
    end: ordered[endIndex],
    endTime: new Date(lastSlotMs + lastSlotSpanMs),
    peak,
    tolerance: Math.max(0, tolerance),
  };
};

/** Below this share of usable hours near the peak, the day has a real best window. */
const EVEN_DAY_SHARE = 0.75;
/** An even day needs enough usable hours for "all day" to mean something. */
const EVEN_DAY_MIN_SLOTS = 6;
/** Hours this far below the peak are called out as the weak spots of an otherwise even day. */
const WEAK_HOUR_GAP = 5;

export interface EvenDayAssessment<T extends ScoredWeatherWindow = ScoredWeatherWindow> {
  /** Most usable hours sit within the tolerance of the peak: no single window is "best". */
  even: boolean;
  /** Usable hours clearly below the peak (score gap > 5), in time order. */
  weakSlots: T[];
}

/**
 * A forecast cannot honestly say 13:00 is the best hour when 11 of 12 usable hours score within
 * three points of it. This flags such a day so the UI says "similar all day" and names only the
 * hours that are clearly weaker, instead of promoting a near-arbitrary window.
 */
export const assessEvenDay = <T extends ScoredWeatherWindow>(
  slots: readonly T[],
  tolerance = DEFAULT_TOLERANCE,
  isEligible: (slot: T) => boolean = () => true
): EvenDayAssessment<T> => {
  const usable = slots.filter(slot => isEligible(slot));
  if (usable.length < EVEN_DAY_MIN_SLOTS) return { even: false, weakSlots: [] };
  // "Any time" must be true: if a gated hour (rain, storm, darkness) splits the usable hours,
  // the day has separate windows, not one even stretch.
  const ordered = [...slots].sort((a, b) => a.time.getTime() - b.time.getTime());
  const first = ordered.findIndex(slot => isEligible(slot));
  const last = ordered.length - 1 - [...ordered].reverse().findIndex(slot => isEligible(slot));
  if (ordered.slice(first, last + 1).some(slot => !isEligible(slot))) {
    return { even: false, weakSlots: [] };
  }
  const peak = Math.max(...usable.map(slot => slot.score));
  const near = usable.filter(slot => slot.score >= peak - Math.max(0, tolerance)).length;
  const even = near / usable.length >= EVEN_DAY_SHARE;
  const weakSlots = even
    ? [...usable]
        .filter(slot => slot.score < peak - WEAK_HOUR_GAP)
        .sort((a, b) => a.time.getTime() - b.time.getTime())
    : [];
  return { even, weakSlots };
};
