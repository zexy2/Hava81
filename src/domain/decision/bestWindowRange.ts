import type { BestWindowRange, ScoredWeatherWindow } from "./types";

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
  tolerance = DEFAULT_TOLERANCE
): BestWindowRange<T> | undefined => {
  if (!slots.length) return undefined;
  const ordered = [...slots].sort((a, b) => a.time.getTime() - b.time.getTime());
  const peak = ordered.reduce((best, slot) => (slot.score > best.score ? slot : best), ordered[0]);
  const peakIndex = ordered.indexOf(peak);
  const positiveGaps = ordered
    .slice(1)
    .map((slot, index) => slot.time.getTime() - ordered[index].time.getTime())
    .filter(gap => gap > 0 && Number.isFinite(gap));
  const cadenceMs = median(positiveGaps);
  const maxAdjacentGapMs = cadenceMs * 1.6;
  const floor = peak.score - Math.max(0, tolerance);
  const isRiskCompatible = (candidate: T) => peak.reasons.length > 0 || candidate.reasons.length === 0;

  const maxRangeMs = DEFAULT_MAX_RANGE_HOURS * HOUR_MS;
  let startIndex = peakIndex;
  let endIndex = peakIndex;

  // A mathematically near-flat 12-hour period should not become an unhelpful 10–12 hour
  // recommendation. Grow around the peak while the neighboring point is still near-best,
  // contiguous, and keeps the user-facing interval within a practical four-hour span.
  while (true) {
    const left = startIndex > 0 ? ordered[startIndex - 1] : undefined;
    const right = endIndex < ordered.length - 1 ? ordered[endIndex + 1] : undefined;
    const leftGap = left ? ordered[startIndex].time.getTime() - left.time.getTime() : Number.POSITIVE_INFINITY;
    const rightGap = right ? right.time.getTime() - ordered[endIndex].time.getTime() : Number.POSITIVE_INFINITY;
    const canTakeLeft = Boolean(
      left &&
        left.score >= floor &&
        isRiskCompatible(left) &&
        leftGap <= maxAdjacentGapMs &&
        ordered[endIndex].time.getTime() - left.time.getTime() <= maxRangeMs
    );
    const canTakeRight = Boolean(
      right &&
        right.score >= floor &&
        isRiskCompatible(right) &&
        rightGap <= maxAdjacentGapMs &&
        right.time.getTime() - ordered[startIndex].time.getTime() <= maxRangeMs
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

  return {
    start: ordered[startIndex],
    end: ordered[endIndex],
    peak,
    tolerance: Math.max(0, tolerance),
  };
};
