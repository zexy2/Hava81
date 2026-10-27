import type { WeatherDataMeta } from '../types';
import { getSourceObservationFreshness } from './sourceObservationFreshness';

const CURRENT_FRESHNESS_FALLBACK_SECONDS = 300;
const MAX_CURRENT_FRESHNESS_SECONDS = 86_400;
const MAX_FUTURE_SKEW_MS = 60_000;
const CURRENT_EXPIRY_CUSHION_MS = 100;

export interface CurrentWeatherFreshnessState {
  fresh: boolean;
  status: 'fresh' | 'stale' | 'unknown';
  ageMinutes: number | null;
  expiresInMs: number | null;
}

const unknownFreshness = (): CurrentWeatherFreshnessState => ({
  fresh: false,
  status: 'unknown',
  ageMinutes: null,
  expiresInMs: null,
});

export function getCurrentWeatherFreshness(
  meta: (WeatherDataMeta & { observedAt?: Date | string }) | null,
  now = Date.now()
): CurrentWeatherFreshnessState {
  if (!meta?.fetchedAt) return unknownFreshness();
  const fetchedAtMs =
    meta.fetchedAt instanceof Date ? meta.fetchedAt.getTime() : new Date(meta.fetchedAt).getTime();
  if (!Number.isFinite(fetchedAtMs)) return unknownFreshness();

  const observation = getSourceObservationFreshness(meta.observedAt, now);
  if (observation && observation.status === 'unknown') return unknownFreshness();
  if (observation && observation.status === 'stale') {
    return {
      fresh: false,
      status: 'stale',
      ageMinutes: observation.ageMs === null ? null : Math.max(0, Math.floor(observation.ageMs / 60_000)),
      expiresInMs: null,
    };
  }

  const explicitTtl = meta.freshForSeconds;
  if (
    explicitTtl !== undefined &&
    (!Number.isFinite(explicitTtl) ||
      explicitTtl <= 0 ||
      explicitTtl > MAX_CURRENT_FRESHNESS_SECONDS)
  ) {
    return unknownFreshness();
  }
  const ttlSeconds = explicitTtl ?? CURRENT_FRESHNESS_FALLBACK_SECONDS;
  const ageMs = now - fetchedAtMs;
  if (ageMs < -MAX_FUTURE_SKEW_MS) return unknownFreshness();

  const remainingMs = fetchedAtMs + ttlSeconds * 1000 - now;
  const fresh = ageMs <= ttlSeconds * 1000;
  const cacheExpiryMs = fresh && remainingMs >= 0 ? remainingMs + CURRENT_EXPIRY_CUSHION_MS : null;
  const displayAgeMs = observation?.ageMs ?? ageMs;

  return {
    fresh,
    status: fresh ? 'fresh' : 'stale',
    ageMinutes: Math.max(0, Math.floor(displayAgeMs / 60_000)),
    expiresInMs:
      fresh && cacheExpiryMs !== null
        ? Math.min(cacheExpiryMs, observation?.expiresInMs ?? Number.POSITIVE_INFINITY)
        : null,
  };
}
