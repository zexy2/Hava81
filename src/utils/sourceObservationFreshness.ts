const MAX_SOURCE_OBSERVATION_AGE_MS = 2 * 60 * 60 * 1_000;
const MAX_SOURCE_FUTURE_SKEW_MS = 60_000;
const SOURCE_EXPIRY_CUSHION_MS = 100;

export interface SourceObservationFreshnessState {
  status: 'fresh' | 'stale' | 'unknown';
  ageMs: number | null;
  expiresInMs: number | null;
}

/**
 * Check the source sample's own timestamp separately from BFF fetch/cache freshness.
 * Missing timestamps retain compatibility with older API revisions; when present, an
 * invalid or materially future timestamp fails closed, and current AQI samples older than
 * two hours are not eligible as current-reading fallback evidence.
 */
export function getSourceObservationFreshness(
  observedAt: Date | string | undefined,
  now = Date.now()
): SourceObservationFreshnessState | null {
  if (observedAt === undefined) return null;
  const observedAtMs =
    observedAt instanceof Date ? observedAt.getTime() : new Date(observedAt).getTime();
  if (!Number.isFinite(observedAtMs)) {
    return { status: 'unknown', ageMs: null, expiresInMs: null };
  }

  const ageMs = now - observedAtMs;
  if (ageMs < -MAX_SOURCE_FUTURE_SKEW_MS) {
    return { status: 'unknown', ageMs: null, expiresInMs: null };
  }
  if (ageMs > MAX_SOURCE_OBSERVATION_AGE_MS) {
    return { status: 'stale', ageMs, expiresInMs: null };
  }

  const remainingMs = observedAtMs + MAX_SOURCE_OBSERVATION_AGE_MS - now;
  return {
    status: 'fresh',
    ageMs,
    expiresInMs: remainingMs >= 0 ? remainingMs + SOURCE_EXPIRY_CUSHION_MS : null,
  };
}
