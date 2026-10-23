import { getScoreBand } from '../decision/scoreWeatherWindow';
import { worstPlanConfidence } from './confidence';
import type { PlanAvailability, PlanHourScore, PlanWindow } from './types';

const HOUR_MS = 60 * 60 * 1000;

const median = (values: number[]): number => {
  if (!values.length) return HOUR_MS;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
};

const parseClock = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
};

const localParts = (time: Date, timezoneOffsetSeconds: number) => {
  const local = new Date(time.getTime() + timezoneOffsetSeconds * 1000);
  return {
    weekday: local.getUTCDay(),
    minute: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
};

const minuteInRange = (minute: number, start: number, end: number): boolean =>
  start < end ? minute >= start && minute < end : start > end && (minute >= start || minute < end);

const matchesAvailability = (
  start: Date,
  end: Date,
  slots: PlanHourScore[],
  timezoneOffsetSeconds: number,
  availability?: PlanAvailability
): boolean => {
  if (!availability) return true;
  const allowedWeekdays = availability.weekdays;
  const startMinute = parseClock(availability.startTime);
  const endMinute = parseClock(availability.endTime);
  if (availability.startTime !== undefined && startMinute === undefined) return false;
  if (availability.endTime !== undefined && endMinute === undefined) return false;
  if ((startMinute === undefined) !== (endMinute === undefined)) return false;

  const checkedTimes = [...slots.map(slot => slot.time), new Date(end.getTime() - 1)];
  for (const time of checkedTimes) {
    const local = localParts(time, timezoneOffsetSeconds);
    if (allowedWeekdays && !allowedWeekdays.includes(local.weekday)) return false;
    if (
      startMinute !== undefined &&
      endMinute !== undefined &&
      !minuteInRange(local.minute, startMinute, endMinute)
    ) {
      return false;
    }
  }
  return start.getTime() < end.getTime();
};

/**
 * Find up to three high-scoring, non-overlapping windows. A candidate is rejected if any covered
 * hour is gated, a forecast gap breaks coverage, or the selected duration extends beyond data.
 */
export const findWindows = (
  input: PlanHourScore[],
  options: {
    durationMinutes: number;
    timezoneOffsetSeconds: number;
    availability?: PlanAvailability;
    maxWindows?: number;
  }
): PlanWindow[] => {
  const { durationMinutes, timezoneOffsetSeconds, availability, maxWindows = 3 } = options;
  const limit = Number.isFinite(maxWindows) ? Math.floor(maxWindows) : 3;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || limit <= 0) return [];
  const ordered = [...input].sort((a, b) => a.time.getTime() - b.time.getTime());
  if (!ordered.length) return [];

  // The Plan v3 engine expects hourly slots. Do not infer coverage from a sparse cadence: if a
  // multi-slot input contains no hourly-ish interval, we cannot justify any continuous window.
  const observedGaps = ordered
    .slice(1)
    .map((slot, index) => slot.time.getTime() - ordered[index].time.getTime());
  const hourlyGaps = observedGaps.filter(gap => gap > 0 && gap <= HOUR_MS * 1.5);
  if (ordered.length > 1 && hourlyGaps.length === 0) return [];

  const cadenceMs = median(hourlyGaps);
  const maxGapMs = cadenceMs * 1.6;
  const durationMs = durationMinutes * 60 * 1000;
  const candidates: PlanWindow[] = [];

  for (const startSlot of ordered) {
    if (!startSlot.eligible) continue;
    const startMs = startSlot.time.getTime();
    const endMs = startMs + durationMs;
    const slots = ordered.filter(
      slot => slot.time.getTime() >= startMs && slot.time.getTime() < endMs
    );
    if (!slots.length || slots[0] !== startSlot) continue;

    const lastCoveredMs = slots[slots.length - 1].time.getTime() + cadenceMs;
    if (lastCoveredMs < endMs) continue;
    if (slots.some(slot => !slot.eligible)) continue;

    let contiguous = true;
    for (let index = 1; index < slots.length; index += 1) {
      const gap = slots[index].time.getTime() - slots[index - 1].time.getTime();
      if (gap <= 0 || gap > maxGapMs) {
        contiguous = false;
        break;
      }
    }
    if (!contiguous) continue;

    const start = new Date(startMs);
    const end = new Date(endMs);
    if (!matchesAvailability(start, end, slots, timezoneOffsetSeconds, availability)) continue;

    let weightedScore = 0;
    let coveredMs = 0;
    for (const slot of slots) {
      const slotStart = slot.time.getTime();
      const overlapMs = Math.max(0, Math.min(endMs, slotStart + cadenceMs) - slotStart);
      weightedScore += slot.score * overlapMs;
      coveredMs += overlapMs;
    }
    if (coveredMs < durationMs) continue;

    const averageScore = Math.max(0, Math.min(100, Math.round(weightedScore / coveredMs)));
    const peak = slots.reduce((best, slot) => (slot.score > best.score ? slot : best), slots[0]);
    const reasons = [...new Set(slots.flatMap(slot => slot.reasons))];
    // A window aggregates multiple hours; one risky slot must not disappear in the average and
    // let the entire window receive the excellent band.
    const score = reasons.length > 0 ? Math.min(96, averageScore) : averageScore;
    candidates.push({
      start,
      end,
      score,
      band: getScoreBand(score),
      confidence: worstPlanConfidence(...slots.map(slot => slot.confidence)),
      slots,
      peak,
      reasons,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime());
  const selected: PlanWindow[] = [];
  for (const candidate of candidates) {
    const overlaps = selected.some(
      existing => candidate.start < existing.end && candidate.end > existing.start
    );
    if (overlaps) continue;
    selected.push(candidate);
    if (selected.length >= limit) break;
  }
  return selected.sort((a, b) => a.start.getTime() - b.start.getTime());
};
