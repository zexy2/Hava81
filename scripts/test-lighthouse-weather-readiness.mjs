import assert from 'node:assert/strict';
import {
  assertLighthouseWeatherReady,
  withLighthouseWeatherReadinessConfirmation,
} from './lib/lighthouse-weather-readiness.mjs';

const report = requests => ({
  audits: {
    'network-requests': {
      details: { items: requests },
    },
  },
});
const currentWeather = statusCode => ({
  url: 'http://127.0.0.1:4173/api/v1/weather/current?city=Istanbul',
  statusCode,
});
const readyReport = report([
  { url: 'http://127.0.0.1:4173/api/v1/health/ready', statusCode: 200 },
  currentWeather(200),
]);

assert.equal(
  assertLighthouseWeatherReady(readyReport),
  true,
  'a successful current-weather response should allow scoring'
);

for (const [label, requests] of [
  ['missing current-weather request', []],
  ['cross-origin/CORS failure', [{ ...currentWeather(-1), rendererStartTime: 100, networkEndTime: 30_100 }]],
  ['upstream failure', [currentWeather(503)]],
  ['wrong endpoint', [{ url: 'http://127.0.0.1:4173/api/v1/weather/forecast', statusCode: 200 }]],
  ['malformed URL', [{ url: 'not a URL', statusCode: 200 }]],
]) {
  assert.throws(
    () => assertLighthouseWeatherReady(report(requests)),
    /refusing to score the loading\/error shell/,
    label
  );
}

let confirmationCalls = 0;
const recovered = await withLighthouseWeatherReadinessConfirmation(
  report([{ ...currentWeather(-1), rendererStartTime: 100, networkEndTime: 30_100 }]),
  async () => {
    confirmationCalls += 1;
    return readyReport;
  }
);
assert.equal(recovered, readyReport, 'the successful confirmation report should be scored');
assert.equal(confirmationCalls, 1, 'readiness failure should trigger exactly one confirmation');

confirmationCalls = 0;
const firstPass = await withLighthouseWeatherReadinessConfirmation(readyReport, async () => {
  confirmationCalls += 1;
  throw new Error('confirmation should not run');
});
assert.equal(firstPass, readyReport, 'a ready first report should be retained');
assert.equal(confirmationCalls, 0, 'a ready first report should not trigger a second measurement');

await assert.rejects(
  withLighthouseWeatherReadinessConfirmation(report([currentWeather(-1)]), async () =>
    report([currentWeather(503)])
  ),
  error => {
    assert.match(error.message, /statusCode=503/);
    assert.match(error.message, /first measurement also failed readiness/);
    assert.match(error.message, /statusCode=-1/);
    return true;
  },
  'two failed readiness measurements must remain a hard failure with both diagnostics'
);

await assert.rejects(
  withLighthouseWeatherReadinessConfirmation(report([currentWeather(-1)]), async () => {
    throw new Error('confirmation measurement crashed');
  }),
  /confirmation measurement crashed.*first measurement also failed readiness/,
  'a failed confirmation process must preserve the first readiness failure'
);

console.log('Lighthouse weather-data readiness and bounded confirmation contract: PASS');
