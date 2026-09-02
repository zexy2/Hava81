const OPTIONAL_FRESHNESS_FALLBACK_SECONDS = 300;
const MAX_OPTIONAL_FUTURE_SKEW_MS = 60_000;
const OPTIONAL_EXPIRY_CUSHION_MS = 100;

export interface OptionalEvidenceMeta {
  fetchedAt?: Date | string;
  freshForSeconds?: number;
}

export interface OptionalEvidenceFreshnessState {
  fresh: boolean;
  status: 'fresh' | 'stale' | 'unknown';
  expiresInMs: number | null;
}

const unknownFreshness = (): OptionalEvidenceFreshnessState => ({
  fresh: false,
  status: 'unknown',
  expiresInMs: null,
});

export function getOptionalEvidenceFreshness(
  meta: OptionalEvidenceMeta | null | undefined,
  now = Date.now()
): OptionalEvidenceFreshnessState {
  if (!meta?.fetchedAt) return unknownFreshness();
  const fetchedAtMs =
    meta.fetchedAt instanceof Date ? meta.fetchedAt.getTime() : new Date(meta.fetchedAt).getTime();
  if (!Number.isFinite(fetchedAtMs)) return unknownFreshness();

  const ttlSeconds =
    typeof meta.freshForSeconds === 'number' &&
    Number.isFinite(meta.freshForSeconds) &&
    meta.freshForSeconds > 0
      ? meta.freshForSeconds
      : OPTIONAL_FRESHNESS_FALLBACK_SECONDS;
  const ageMs = now - fetchedAtMs;
  if (ageMs < -MAX_OPTIONAL_FUTURE_SKEW_MS) return unknownFreshness();

  const remainingMs = fetchedAtMs + ttlSeconds * 1000 - now;
  const fresh = ageMs <= ttlSeconds * 1000;

  return {
    fresh,
    status: fresh ? 'fresh' : 'stale',
    expiresInMs: fresh && remainingMs >= 0 ? remainingMs + OPTIONAL_EXPIRY_CUSHION_MS : null,
  };
}
