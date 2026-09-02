import type { CurrentWeatherMeta } from '../types';

const CURRENT_FRESHNESS_FALLBACK_SECONDS = 300;
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
  meta: CurrentWeatherMeta | null,
  now = Date.now()
): CurrentWeatherFreshnessState {
  if (!meta?.fetchedAt) return unknownFreshness();
  const fetchedAtMs =
    meta.fetchedAt instanceof Date ? meta.fetchedAt.getTime() : new Date(meta.fetchedAt).getTime();
  if (!Number.isFinite(fetchedAtMs)) return unknownFreshness();

  const ttlSeconds =
    typeof meta.freshForSeconds === 'number' &&
    Number.isFinite(meta.freshForSeconds) &&
    meta.freshForSeconds > 0
      ? meta.freshForSeconds
      : CURRENT_FRESHNESS_FALLBACK_SECONDS;
  const ageMs = now - fetchedAtMs;
  if (ageMs < -MAX_FUTURE_SKEW_MS) return unknownFreshness();

  const remainingMs = fetchedAtMs + ttlSeconds * 1000 - now;
  const fresh = ageMs <= ttlSeconds * 1000;

  return {
    fresh,
    status: fresh ? 'fresh' : 'stale',
    ageMinutes: Math.max(0, Math.floor(ageMs / 60_000)),
    expiresInMs: fresh && remainingMs >= 0 ? remainingMs + CURRENT_EXPIRY_CUSHION_MS : null,
  };
}
