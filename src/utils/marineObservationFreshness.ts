import { getSourceObservationFreshness } from './sourceObservationFreshness';
import type { SourceObservationFreshnessState } from './sourceObservationFreshness';

const unknownFreshness = (): SourceObservationFreshnessState => ({
  status: 'unknown',
  ageMs: null,
  expiresInMs: null,
});

/**
 * Open-Meteo Marine's `current.time` may be a location-local wall-clock string when
 * `timezone=auto` is used. Normalize that form with the forecast location's UTC offset
 * before applying the shared source-age guard; never let the browser's own timezone decide.
 */
export function getMarineObservationFreshness(
  observedAt: Date | string | undefined,
  timezoneOffsetSeconds: number,
  now = Date.now()
): SourceObservationFreshnessState {
  if (observedAt === undefined) return unknownFreshness();

  if (observedAt instanceof Date) {
    return getSourceObservationFreshness(observedAt, now) ?? unknownFreshness();
  }

  const value = observedAt.trim();
  if (!value) return unknownFreshness();

  // An explicit zone is already an absolute instant. Do not apply the location offset twice.
  if (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value)) {
    return getSourceObservationFreshness(value, now) ?? unknownFreshness();
  }

  if (!Number.isFinite(timezoneOffsetSeconds) || Math.abs(timezoneOffsetSeconds) > 14 * 60 * 60) {
    return unknownFreshness();
  }

  // Parse the wall-clock fields as UTC first so behavior is independent of the user's device
  // timezone, then convert local time to UTC using the location's offset (local = UTC + offset).
  const wallClockAsUtcMs = new Date(`${value}Z`).getTime();
  if (!Number.isFinite(wallClockAsUtcMs)) {
    return unknownFreshness();
  }

  return (
    getSourceObservationFreshness(
      new Date(wallClockAsUtcMs - timezoneOffsetSeconds * 1000),
      now
    ) ?? unknownFreshness()
  );
}
