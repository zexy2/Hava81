import type { ForecastMeta } from '../types';

const FORECAST_FRESHNESS_FALLBACK_SECONDS = 1_800;
const MAX_FUTURE_SKEW_MS = 60_000;
const FORECAST_EXPIRY_CUSHION_MS = 100;

export interface ForecastFreshnessState {
  fresh: boolean;
  expiresInMs: number | null;
}

export function getForecastFreshness(meta: ForecastMeta | null): ForecastFreshnessState {
  if (!meta?.fetchedAt) return { fresh: false, expiresInMs: null };
  const fetchedAtMs =
    meta.fetchedAt instanceof Date ? meta.fetchedAt.getTime() : new Date(meta.fetchedAt).getTime();
  if (!Number.isFinite(fetchedAtMs)) return { fresh: false, expiresInMs: null };

  const ttlSeconds =
    typeof meta.freshForSeconds === 'number' &&
    Number.isFinite(meta.freshForSeconds) &&
    meta.freshForSeconds > 0
      ? meta.freshForSeconds
      : FORECAST_FRESHNESS_FALLBACK_SECONDS;
  const ageMs = Date.now() - fetchedAtMs;
  const fresh = ageMs >= -MAX_FUTURE_SKEW_MS && ageMs <= ttlSeconds * 1000;
  const remainingMs = fetchedAtMs + ttlSeconds * 1000 - Date.now();

  return {
    fresh,
    expiresInMs: fresh && remainingMs > 0 ? remainingMs + FORECAST_EXPIRY_CUSHION_MS : null,
  };
}
