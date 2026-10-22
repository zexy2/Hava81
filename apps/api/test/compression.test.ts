import assert from 'node:assert/strict';
import test from 'node:test';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { buildApp } from '../src/app';
import { envSchema } from '../src/config/env';
import type {
  ProvinceCurrentObservation,
  ProvinceCurrentProvider,
  ProvincePoint,
} from '../src/providers/openmeteo/openmeteo-provinces.provider';
import type { WeatherProvider } from '../src/providers/weather-provider';

const env = envSchema.parse({ NODE_ENV: 'test', OPENWEATHER_API_KEY: 'k' });
const unusedProvider = {} as WeatherProvider;

// 81 provinces → a multi-KB JSON body, well above the 1 KB compression threshold.
const provincesProvider: ProvinceCurrentProvider = {
  name: 'FakeMeteo',
  attribution: 'Fake · test',
  async getCurrent(points: readonly ProvincePoint[]): Promise<Array<ProvinceCurrentObservation | null>> {
    return points.map(point => ({
      temperature: Math.round(point.lat * 10) / 10,
      weatherCode: 0,
      isDay: true,
      windSpeed: 2.5,
      observedAt: '2026-10-21T12:00:00.000Z',
    }));
  },
};

const url = '/api/v1/weather/provinces?lang=tr';

const build = async () =>
  buildApp({ env, provider: unusedProvider, provincesProvider, logger: false });

test('JSON responses are brotli/gzip compressed when the client accepts it', async t => {
  const app = await build();
  t.after(() => app.close());

  const plain = await app.inject({ method: 'GET', url });
  assert.equal(plain.statusCode, 200);
  assert.equal(plain.headers['content-encoding'], undefined);
  // meta.cacheStatus flips MISS → HIT after the first call; compare the data.
  const expected = plain.json().provinces;
  assert.ok(plain.rawPayload.length > 1024, 'fixture must exceed the compression threshold');

  const br = await app.inject({ method: 'GET', url, headers: { 'accept-encoding': 'br, gzip' } });
  assert.equal(br.statusCode, 200);
  assert.equal(br.headers['content-encoding'], 'br');
  assert.match(String(br.headers['content-type']), /^application\/json/);
  assert.match(String(br.headers.vary), /accept-encoding/i);
  assert.ok(br.rawPayload.length < plain.rawPayload.length / 2, 'brotli body should be much smaller');
  assert.deepEqual(JSON.parse(brotliDecompressSync(br.rawPayload).toString('utf8')).provinces, expected);

  const gzip = await app.inject({ method: 'GET', url, headers: { 'accept-encoding': 'gzip' } });
  assert.equal(gzip.headers['content-encoding'], 'gzip');
  assert.deepEqual(JSON.parse(gunzipSync(gzip.rawPayload).toString('utf8')).provinces, expected);
});

test('small JSON responses stay uncompressed', async t => {
  const app = await build();
  t.after(() => app.close());

  const health = await app.inject({
    method: 'GET',
    url: '/api/v1/health/live',
    headers: { 'accept-encoding': 'br, gzip' },
  });
  assert.equal(health.statusCode, 200);
  assert.equal(health.headers['content-encoding'], undefined);
  assert.equal(typeof health.json(), 'object');
});
