import { URL } from 'node:url';

/** Reuse successful live JSON API responses across responsive visual variants.
 * Cache each URL + language only for a bounded window, and never replay a
 * provider response beyond its advertised freshness lifetime. The current
 * weather fallback TTL is five minutes, so the default two-minute window keeps
 * long audits from turning valid first-page weather into stale evidence.
 * Never store failures (including 429), private methods, or non-JSON bodies.
 */
export function createLiveAuditResponseCache({
  maxBytes = 2_000_000,
  maxAgeMs = 120_000,
  freshnessSafetyMarginMs = 30_000,
  now = Date.now,
} = {}) {
  const capturedResponses = new Map();
  const stats = { captured: 0, replayed: 0, uncached: 0 };
  const keepHeaders = [
    'content-type', 'access-control-allow-origin',
    'access-control-allow-credentials', 'cache-control',
  ];

  async function handle(route, language) {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET' || !url.pathname.startsWith('/api/v1/weather/')) {
      return route.continue();
    }
    const key = `${language}:${request.url()}`;
    const currentTime = now();
    const cached = capturedResponses.get(key);
    if (cached) {
      const ageMs = currentTime - cached.capturedAt;
      if (ageMs >= 0 && ageMs < cached.ttlMs) {
        stats.replayed += 1;
        return route.fulfill({ status: cached.status, headers: cached.headers, body: cached.body });
      }
      // Expired evidence must be refreshed from the live API, never replayed.
      capturedResponses.delete(key);
    }

    const response = await route.fetch({ timeout: 25_000 });
    const headers = response.headers();
    const type = headers['content-type'] ?? '';
    if (response.ok() && /(?:application|[^;]+\+)\/json/i.test(type)) {
      const body = await response.body();
      if (body.byteLength <= maxBytes) {
        let payload;
        try {
          payload = JSON.parse(body.toString('utf8'));
        } catch {
          payload = undefined;
        }

        if (payload !== undefined) {
          const meta = payload && typeof payload === 'object' && !Array.isArray(payload)
            ? payload.meta
            : undefined;
          const hasFreshnessLifetime = meta && Object.hasOwn(meta, 'freshForSeconds');
          let ttlMs = maxAgeMs;
          if (hasFreshnessLifetime) {
            const freshForSeconds = meta.freshForSeconds;
            const fetchedAtMs = typeof meta.fetchedAt === 'string'
              ? Date.parse(meta.fetchedAt)
              : Number.NaN;
            if (
              typeof freshForSeconds !== 'number' ||
              !Number.isFinite(freshForSeconds) ||
              freshForSeconds <= 0 ||
              !Number.isFinite(fetchedAtMs)
            ) {
              ttlMs = 0;
            } else {
              ttlMs = Math.min(
                maxAgeMs,
                fetchedAtMs + freshForSeconds * 1000 - currentTime - freshnessSafetyMarginMs,
              );
            }
          }

          if (ttlMs > 0) {
            capturedResponses.set(key, {
              status: response.status(),
              headers: Object.fromEntries(keepHeaders.filter(name => headers[name] !== undefined)
                .map(name => [name, headers[name]])),
              body,
              capturedAt: currentTime,
              ttlMs,
            });
            stats.captured += 1;
            return route.fulfill({ response, body });
          }
        }
      }
    }
    stats.uncached += 1;
    return route.fulfill({ response });
  }

  return { handle, stats };
}
