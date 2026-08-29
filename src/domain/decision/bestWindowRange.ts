import type { BestWindowRange, ScoredWeatherWindow } from "./types";

const DEFAULT_TOLERANCE = 3;

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

  let startIndex = peakIndex;
  while (startIndex > 0) {
    const current = ordered[startIndex];
    const previous = ordered[startIndex - 1];
    const gap = current.time.getTime() - previous.time.getTime();
    if (previous.score < floor || gap > maxAdjacentGapMs) break;
    startIndex -= 1;
  }

  let endIndex = peakIndex;
  while (endIndex < ordered.length - 1) {
    const current = ordered[endIndex];
    const next = ordered[endIndex + 1];
    const gap = next.time.getTime() - current.time.getTime();
    if (next.score < floor || gap > maxAdjacentGapMs) break;
    endIndex += 1;
  }

  return {
    start: ordered[startIndex],
    end: ordered[endIndex],
    peak,
    tolerance: Math.max(0, tolerance),
  };
};
