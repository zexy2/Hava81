import assert from 'node:assert/strict';
import { assertLighthouseWeatherReady, retryLighthouseWeatherReadiness } from './lib/lighthouse-weather-readiness.mjs';

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

const readyReport = report([
  { url: 'http://127.0.0.1:4173/api/v1/weather/current?city=Istanbul', statusCode: 200 },
]);
const unavailableReport = report([
  { url: 'http://127.0.0.1:4173/api/v1/weather/current?city=Istanbul', statusCode: -1 },
]);
let rerunCount = 0;
assert.equal(
  await retryLighthouseWeatherReadiness(readyReport, async () => {
    rerunCount += 1;
    return unavailableReport;
  }),
  readyReport,
  'a ready first report should be reused without a second live measurement'
);
assert.equal(rerunCount, 0);

const recoveredReport = await retryLighthouseWeatherReadiness(unavailableReport, async firstError => {
  rerunCount += 1;
  assert.match(firstError.message, /refusing to score the loading\/error shell/);
  return readyReport;
});
assert.equal(recoveredReport, readyReport, 'a successful real-API confirmation should be scored');
assert.equal(rerunCount, 1, 'readiness failure should trigger exactly one confirmation measurement');

await assert.rejects(
  () => retryLighthouseWeatherReadiness(unavailableReport, async () => unavailableReport),
  /refusing to score the loading\/error shell/,
  'two unavailable reports must remain a hard failure'
);

console.log('Lighthouse weather-data readiness contract: PASS');
