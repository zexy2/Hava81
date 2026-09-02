import type { CurrentWeatherMeta } from '../types';

const CURRENT_FRESHNESS_FALLBACK_SECONDS = 300;
const MAX_FUTURE_SKEW_MS = 60_000;
const CURRENT_EXPIRY_CUSHION_MS = 100;

export interface CurrentWeatherFreshnessState {
  fresh: boolean;
  expiresInMs: number | null;
}

export function getCurrentWeatherFreshness(
  meta: CurrentWeatherMeta | null,
  now = Date.now()
): CurrentWeatherFreshnessState {
  if (!meta?.fetchedAt) return { fresh: false, expiresInMs: null };
  const fetchedAtMs =
    meta.fetchedAt instanceof Date ? meta.fetchedAt.getTime() : new Date(meta.fetchedAt).getTime();
  if (!Number.isFinite(fetchedAtMs)) return { fresh: false, expiresInMs: null };

  const ttlSeconds =
    typeof meta.freshForSeconds === 'number' &&
    Number.isFinite(meta.freshForSeconds) &&
    meta.freshForSeconds > 0
      ? meta.freshForSeconds
      : CURRENT_FRESHNESS_FALLBACK_SECONDS;
  const ageMs = now - fetchedAtMs;
  const remainingMs = fetchedAtMs + ttlSeconds * 1000 - now;
  const fresh = ageMs >= -MAX_FUTURE_SKEW_MS && ageMs <= ttlSeconds * 1000;

  return {
    fresh,
    expiresInMs: fresh && remainingMs > 0 ? remainingMs + CURRENT_EXPIRY_CUSHION_MS : null,
  };
}
