import { Buffer } from 'node:buffer';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveAuditResponseCache } from './lib/live-audit-response-cache.mjs';

function makeRoute({ url = 'https://api.hava81.zekiakgul.dev/api/v1/weather/current?city=izmir',
  method = 'GET', status = 200, type = 'application/json; charset=utf-8',
  body = '{"weather":"clear"}' } = {}) {
  const calls = { fetch: 0, fulfilled: [], continue: 0 };
  return {
    calls,
    request: () => ({ url: () => url, method: () => method }),
    async fetch() {
      calls.fetch += 1;
      return {
        status: () => status,
        ok: () => status >= 200 && status < 300,
        headers: () => ({ 'content-type': type, 'access-control-allow-origin': '*', 'content-encoding': 'gzip' }),
        body: async () => Buffer.from(body),
      };
    },
    async fulfill(options) { calls.fulfilled.push(options); },
    async continue() { calls.continue += 1; },
  };
}

test('captures one live response, then replays it with safe headers', async () => {
  const cache = createLiveAuditResponseCache();
  const first = makeRoute();
  await cache.handle(first, 'tr');
  assert.equal(first.calls.fetch, 1);
  assert.equal(first.calls.fulfilled.length, 1);
  const second = makeRoute();
  await cache.handle(second, 'tr');
  assert.equal(second.calls.fetch, 0);
  assert.equal(second.calls.fulfilled[0].status, 200);
  assert.equal(second.calls.fulfilled[0].body.toString(), '{"weather":"clear"}');
  assert.equal(second.calls.fulfilled[0].headers['access-control-allow-origin'], '*');
  assert.equal(second.calls.fulfilled[0].headers['content-encoding'], undefined);
  assert.deepEqual(cache.stats, { captured: 1, replayed: 1, uncached: 0 });
});

test('refreshes cached live responses before the bounded audit cache expires', async () => {
  let currentTime = 0;
  const cache = createLiveAuditResponseCache({ maxAgeMs: 120_000, now: () => currentTime });
  const first = makeRoute();
  await cache.handle(first, 'tr');

  currentTime = 119_999;
  const stillFresh = makeRoute();
  await cache.handle(stillFresh, 'tr');
  assert.equal(stillFresh.calls.fetch, 0);

  currentTime = 120_000;
  const refreshed = makeRoute();
  await cache.handle(refreshed, 'tr');
  assert.equal(refreshed.calls.fetch, 1);
  assert.deepEqual(cache.stats, { captured: 2, replayed: 1, uncached: 0 });
});

test('respects advertised current-weather freshness and does not cache expired evidence', async () => {
  let currentTime = 0;
  const cache = createLiveAuditResponseCache({
    maxAgeMs: 120_000,
    freshnessSafetyMarginMs: 30_000,
    now: () => currentTime,
  });
  const freshBody = () => JSON.stringify({ meta: { fetchedAt: new Date(currentTime).toISOString(), freshForSeconds: 60 } });
  await cache.handle(makeRoute({ body: freshBody() }), 'tr');

  currentTime = 29_999;
  const stillFresh = makeRoute({ body: freshBody() });
  await cache.handle(stillFresh, 'tr');
  assert.equal(stillFresh.calls.fetch, 0);

  currentTime = 30_000;
  const expired = makeRoute({ body: freshBody() });
  await cache.handle(expired, 'tr');
  assert.equal(expired.calls.fetch, 1);
  assert.deepEqual(cache.stats, { captured: 2, replayed: 1, uncached: 0 });
});

test('does not cache malformed JSON or provider freshness metadata without a valid lifetime', async () => {
  for (const body of [
    '{not-json',
    JSON.stringify({ meta: { fetchedAt: new Date(0).toISOString(), freshForSeconds: 20 } }),
    JSON.stringify({ meta: { fetchedAt: 'not-a-date', freshForSeconds: 300 } }),
  ]) {
    const cache = createLiveAuditResponseCache({ now: () => 0 });
    const first = makeRoute({ body });
    const second = makeRoute({ body });
    await cache.handle(first, 'tr');
    await cache.handle(second, 'tr');
    assert.equal(first.calls.fetch, 1);
    assert.equal(second.calls.fetch, 1);
    assert.deepEqual(cache.stats, { captured: 0, replayed: 0, uncached: 2 });
  }
});

test('distinct languages, cities and queries never share an API response', async () => {
  const cache = createLiveAuditResponseCache();
  await cache.handle(makeRoute(), 'tr');
  const english = makeRoute();
  const sanliurfa = makeRoute({ url: 'https://api.hava81.zekiakgul.dev/api/v1/weather/current?city=sanliurfa' });
  await cache.handle(english, 'en');
  await cache.handle(sanliurfa, 'tr');
  assert.equal(english.calls.fetch, 1);
  assert.equal(sanliurfa.calls.fetch, 1);
  assert.equal(cache.stats.captured, 3);
});

test('does not cache 429 rate limits, non-JSON payloads, or oversized responses', async () => {
  for (const input of [
    { status: 429 },
    { type: 'text/plain' },
    { body: 'x'.repeat(20) },
  ]) {
    const cache = createLiveAuditResponseCache({ maxBytes: 16 });
    const first = makeRoute(input);
    const second = makeRoute(input);
    await cache.handle(first, 'tr');
    await cache.handle(second, 'tr');
    assert.equal(second.calls.fetch, 1);
    assert.equal(cache.stats.uncached, 2);
    assert.equal(cache.stats.replayed, 0);
  }
});

test('non-GET requests and non-API paths always continue untouched', async () => {
  const cache = createLiveAuditResponseCache();
  const post = makeRoute({ method: 'POST' });
  const assets = makeRoute({ url: 'https://hava81.zekiakgul.dev/assets/main.js' });
  const unrelatedApi = makeRoute({ url: 'https://api.hava81.zekiakgul.dev/api/v1/account/profile' });
  await cache.handle(post, 'tr');
  await cache.handle(assets, 'tr');
  await cache.handle(unrelatedApi, 'tr');
  assert.equal(post.calls.continue, 1);
  assert.equal(assets.calls.continue, 1);
  assert.equal(unrelatedApi.calls.continue, 1);
  assert.equal(cache.stats.captured, 0);
});
