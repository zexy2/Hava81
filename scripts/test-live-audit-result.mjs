import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLiveAuditErrors } from './lib/live-audit-result.mjs';

const healthyMetrics = {
  city: 'İzmir',
  language: 'tr',
  theme: 'light',
  forecastState: 'ready',
  documentWidth: 320,
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
