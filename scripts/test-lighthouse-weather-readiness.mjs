import assert from 'node:assert/strict';
import { assertLighthouseWeatherReady } from './lib/lighthouse-weather-readiness.mjs';

const report = requests => ({
  audits: {
    'network-requests': {
      details: { items: requests },
    },
  },
});

assert.equal(
  assertLighthouseWeatherReady(
    report([
      { url: 'http://127.0.0.1:4173/api/v1/health/ready', statusCode: 200 },
      { url: 'http://127.0.0.1:4173/api/v1/weather/current?city=Istanbul', statusCode: 200 },
    ])
  ),
  true,
  'a successful current-weather response should allow scoring'
);

for (const [label, requests] of [
  ['missing current-weather request', []],
  ['cross-origin/CORS failure', [{ url: 'http://127.0.0.1:4173/api/v1/weather/current', statusCode: -1 }]],
  ['upstream failure', [{ url: 'http://127.0.0.1:4173/api/v1/weather/current', statusCode: 503 }]],
  ['wrong endpoint', [{ url: 'http://127.0.0.1:4173/api/v1/weather/forecast', statusCode: 200 }]],
  ['malformed URL', [{ url: 'not a URL', statusCode: 200 }]],
]) {
  assert.throws(
    () => assertLighthouseWeatherReady(report(requests)),
    /refusing to score the loading\/error shell/,
    label
  );
}

console.log('Lighthouse weather-data readiness contract: PASS');
