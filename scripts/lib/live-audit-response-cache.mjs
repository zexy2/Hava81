/** Reuse successful live JSON API responses across visual variants.
 * Each URL + language is fetched from the live server once per audit run.
 * Never store failures (including 429), private methods, or non-JSON bodies.
 */
export function createLiveAuditResponseCache({ maxBytes = 2_000_000 } = {}) {
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
    const cached = capturedResponses.get(key);
    if (cached) {
      stats.replayed += 1;
      return route.fulfill({ status: cached.status, headers: cached.headers, body: cached.body });
    }

    const response = await route.fetch({ timeout: 25_000 });
    const headers = response.headers();
    const type = headers['content-type'] ?? '';
    if (response.ok() && /(?:application|[^;]+\+)\/json/i.test(type)) {
      const body = await response.body();
      if (body.byteLength <= maxBytes) {
        capturedResponses.set(key, {
          status: response.status(),
          headers: Object.fromEntries(keepHeaders.filter(name => headers[name] !== undefined)
            .map(name => [name, headers[name]])),
          body,
        });
        stats.captured += 1;
        return route.fulfill({ response, body });
      }
    }
    stats.uncached += 1;
    return route.fulfill({ response });
  }

  return { handle, stats };
}
