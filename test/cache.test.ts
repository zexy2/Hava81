import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryTtlCache } from '../src/core/cache';

test('cache exposes remaining max age without shortening the configured freshness window', async () => {
  let now = 1_000;
  const cache = new MemoryTtlCache(10, () => now);

  const first = await cache.getOrLoad('weather:test', 5_000, async () => ({ value: 1 }));
  assert.equal(first.status, 'MISS');
  assert.equal(first.freshForSeconds, 5);
  assert.equal(first.cacheMaxAgeSeconds, 5);

  now = 3_500;
  const hit = await cache.getOrLoad('weather:test', 5_000, async () => ({ value: 2 }));
  assert.equal(hit.status, 'HIT');
  assert.deepEqual(hit.value, { value: 1 });
  assert.equal(hit.freshForSeconds, 5);
  assert.equal(hit.cacheMaxAgeSeconds, 2);

  now = 5_900;
  const nearlyExpired = await cache.getOrLoad('weather:test', 5_000, async () => ({ value: 3 }));
  assert.equal(nearlyExpired.status, 'HIT');
  assert.equal(nearlyExpired.cacheMaxAgeSeconds, 0);
});
