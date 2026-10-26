import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLiveAuditErrors, formatWeatherRequestFailure, writeLiveAuditResults } from './lib/live-audit-result.mjs';

const healthyMetrics = {
  city: 'İzmir',
  language: 'tr',
  theme: 'light',
  forecastState: 'ready',
  documentWidth: 320,
  smallTargets: [],
  overlaps: { header: 0, scoreDate: 0, scoreDetails: 0, temperatureArt: 0 },
};

const expected = {
  metrics: healthyMetrics,
  expectedCity: 'İzmir',
  language: 'tr',
  theme: 'light',
  width: 320,
};

test('a ready cached-looking forecast does not hide a failed live weather API response', () => {
  const errors = buildLiveAuditErrors({
    ...expected,
    weatherFailures: ['503 https://api.hava81.zekiakgul.dev/api/v1/weather/current'],
  });

  assert.deepEqual(errors, [
    'Weather API: 503 https://api.hava81.zekiakgul.dev/api/v1/weather/current',
  ]);
});

test('duplicate failed responses are reported once without masking layout errors', () => {
  const errors = buildLiveAuditErrors({
    ...expected,
    metrics: { ...healthyMetrics, documentWidth: 334 },
    weatherFailures: ['429 /api/v1/weather/current', '429 /api/v1/weather/current'],
  });

  assert.deepEqual(errors, [
    'Horizontal overflow: 334px > 320px',
    'Weather API: 429 /api/v1/weather/current',
  ]);
});

test('a healthy responsive case stays green and missing metrics fail closed', () => {
  assert.deepEqual(buildLiveAuditErrors(expected), []);
  assert.deepEqual(buildLiveAuditErrors({ ...expected, metrics: null }), ['Responsive metrics unavailable']);
});


test('mobile live audit reports undersized interactive controls but ignores desktop-only measurements', () => {
  const metrics = { ...healthyMetrics, smallTargets: ['Search (40×36)'] };
  assert.deepEqual(buildLiveAuditErrors({ ...expected, metrics }), [
    'Small interactive target: Search (40×36)',
  ]);
  assert.deepEqual(buildLiveAuditErrors({ ...expected, width: 1024, metrics }), []);
});

test('mobile live audit fails closed when interactive target metrics are missing', () => {
  const legacyMetrics = { ...healthyMetrics };
  delete legacyMetrics.smallTargets;
  assert.deepEqual(buildLiveAuditErrors({ ...expected, metrics: legacyMetrics }), [
    'Interactive target metrics unavailable',
  ]);
});

test('live audit reports core weather network failures without query-string noise', () => {
  assert.equal(
    formatWeatherRequestFailure(
      'https://api.hava81.zekiakgul.dev/api/v1/weather/current?city=izmir',
      'net::ERR_CONNECTION_RESET'
    ),
    'network net::ERR_CONNECTION_RESET https://api.hava81.zekiakgul.dev/api/v1/weather/current'
  );
});

test('live audit ignores unrelated routes and expected browser teardown cancellations', () => {
  assert.equal(
    formatWeatherRequestFailure('https://api.hava81.zekiakgul.dev/api/v1/air-quality/current', 'net::ERR_FAILED'),
    null
  );
  assert.equal(
    formatWeatherRequestFailure('https://api.hava81.zekiakgul.dev/api/v1/weather/current', 'net::ERR_ABORTED'),
    null
  );
});


test('live audit persists structured failures even when screenshots are disabled', async t => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'hava81-live-audit-results-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const report = {
    checkedAt: '2026-10-25T01:00:00.000Z',
    baseUrl: 'https://hava81.zekiakgul.dev',
    results: [{ city: 'izmir', ok: false, errors: ['Weather API: 502 /api/v1/weather/hourly'] }],
  };

  const resultPath = await writeLiveAuditResults(outputDirectory, report);
  assert.equal(resultPath, join(outputDirectory, 'results.json'));
  assert.deepEqual(JSON.parse(await readFile(resultPath, 'utf8')), report);
});
