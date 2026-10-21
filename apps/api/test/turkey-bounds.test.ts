import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app';
import { envSchema } from '../src/config/env';
import { MemoryTtlCache } from '../src/core/cache';
import { AppError } from '../src/core/errors';
import { coordinateCacheKey } from '../src/core/geo';
import { UpstreamBudget, withUpstreamBudget } from '../src/core/upstream-budget';

const env = () =>
  envSchema.parse({ NODE_ENV: 'test', OPENWEATHER_API_KEY: 'k', CORS_ORIGINS: 'http://localhost:3000' });

test('coordinates outside Turkey are rejected with 400 on every coordinate endpoint', async (context) => {
  const app = await buildApp({ env: env(), logger: false });
  context.after(() => app.close());
  const urls = [
    '/api/v1/weather/current?lat=40.71&lon=-74',
    '/api/v1/weather/forecast?lat=40.71&lon=-74',
    '/api/v1/weather/hourly?lat=51.5&lon=-0.12',
    '/api/v1/weather/air-quality?lat=48.85&lon=2.35',
    '/api/v1/weather/context?lat=40.71&lon=-74',
    '/api/v1/weather/route?originLat=41&originLon=29&destinationLat=40.71&destinationLon=-74&departure=2026-10-21T10:00:00.000Z',
  ];
  for (const url of urls) {
    const response = await app.inject({ method: 'GET', url });
    assert.equal(response.statusCode, 400, url);
  }
});

test('cache key rounds coordinates to two decimals', () => {
  assert.equal(coordinateCacheKey(41.0123, 28.9789), '41.01:28.98');
  assert.equal(coordinateCacheKey(41.0149, 28.9751), coordinateCacheKey(41.0101, 28.9799));
});

test('upstream budget limits cache misses globally and recovers after the window', async () => {
  let now = 0;
  const budget = new UpstreamBudget(2, 60_000, () => now);
  const cache = withUpstreamBudget(new MemoryTtlCache(100, () => now), budget);
  let loads = 0;
  const load = async () => ++loads;

  await cache.getOrLoad('a', 1_000_000, load);
  await cache.getOrLoad('a', 1_000_000, load); // HIT: does not consume budget
  await cache.getOrLoad('b', 1_000_000, load);
  await assert.rejects(
    () => cache.getOrLoad('c', 1_000_000, load),
    (error: unknown) => error instanceof AppError && error.statusCode === 503,
  );
  assert.equal(loads, 2);

  now = 60_001;
  await cache.getOrLoad('c', 1_000_000, load);
  assert.equal(loads, 3);
});
