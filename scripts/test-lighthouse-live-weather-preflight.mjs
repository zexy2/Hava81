import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchLiveWeatherPreflight } from './lighthouse-live-weather-preflight.mjs';

const validPayload = () => ({
  cityName: 'Istanbul',
  country: 'TR',
  coordinates: { lat: 41.0351, lon: 28.9833 },
  temperature: 14,
  timestamp: '2026-10-27T12:58:00.000Z',
  meta: {
    provider: 'OpenWeather',
    fetchedAt: '2026-10-27T13:00:00.000Z',
    freshForSeconds: 300,
  },
});

const response = (status, payload) => ({
  status,
  ok: status >= 200 && status < 300,
  async json() { return payload; },
});

const makeHarness = sequence => {
  const calls = [];
  const sleeps = [];
  const onRetry = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const next = sequence.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  const sleepImpl = async milliseconds => { sleeps.push(milliseconds); };
  return { calls, sleeps, onRetry, fetchImpl, sleepImpl };
};

{
  const harness = makeHarness([response(504, {}), response(200, validPayload())]);
  const result = await fetchLiveWeatherPreflight('http://127.0.0.1:4000/api/v1/weather/current?city=Istanbul', {
    ...harness,
    onRetry: detail => harness.onRetry.push(detail),
  });
  assert.equal(result.cityName, 'Istanbul');
  assert.equal(result.provider, 'OpenWeather');
  assert.equal(harness.calls.length, 2, 'a transient 504 gets exactly one retry');
  assert.deepEqual(harness.sleeps, [1500]);
  assert.deepEqual(harness.onRetry, [{ attempt: 1, reason: 'HTTP 504' }]);
  assert.equal(harness.calls[0].options.headers.accept, 'application/json');
}

{
  const harness = makeHarness([response(503, {}), response(504, {})]);
  await assert.rejects(
    fetchLiveWeatherPreflight('http://127.0.0.1/weather', { ...harness, onRetry: () => {} }),
    /HTTP 504 after 2 attempt\(s\)/,
  );
  assert.equal(harness.calls.length, 2, 'retries are bounded');
}

{
  const harness = makeHarness([response(429, {})]);
  await assert.rejects(
    fetchLiveWeatherPreflight('http://127.0.0.1/weather', { ...harness, onRetry: () => {} }),
    /HTTP 429 after 1 attempt\(s\)/,
  );
  assert.equal(harness.calls.length, 1, 'rate-limit responses are not amplified');
}

{
  const harness = makeHarness([response(400, {})]);
  await assert.rejects(
    fetchLiveWeatherPreflight('http://127.0.0.1/weather', { ...harness, onRetry: () => {} }),
    /HTTP 400 after 1 attempt\(s\)/,
  );
  assert.equal(harness.calls.length, 1, 'permanent client errors fail fast');
}

{
  const badJson = {
    status: 200,
    ok: true,
    async json() { throw new SyntaxError('invalid JSON'); },
  };
  const harness = makeHarness([badJson]);
  await assert.rejects(
    fetchLiveWeatherPreflight('http://127.0.0.1/weather', { ...harness, onRetry: () => {} }),
    /not valid JSON/,
  );
  assert.equal(harness.calls.length, 1, 'invalid JSON fails closed without retry');
}

{
  const harness = makeHarness([response(200, { ...validPayload(), cityName: 'Ankara' })]);
  await assert.rejects(
    fetchLiveWeatherPreflight('http://127.0.0.1/weather', { ...harness, onRetry: () => {} }),
    /cityName must match/,
  );
  assert.equal(harness.calls.length, 1, 'a malformed successful payload is not hidden by retry');
}

{
  const timeout = new Error('request timed out');
  timeout.name = 'TimeoutError';
  const harness = makeHarness([timeout, response(200, validPayload())]);
  const result = await fetchLiveWeatherPreflight('http://127.0.0.1/weather', {
    ...harness,
    onRetry: detail => harness.onRetry.push(detail),
  });
  assert.equal(result.cityName, 'Istanbul');
  assert.equal(harness.calls.length, 2, 'a timeout gets one retry');
}

{
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
  assert.match(workflow, /Validate bounded live-weather preflight retry contract[\s\S]*?scripts\/test-lighthouse-live-weather-preflight\.mjs/);
  assert.match(workflow, /scripts\/lighthouse-live-weather-preflight\.mjs[\s\S]*?weather\/current\?city=Istanbul/);
  assert.match(workflow, /refusing a synthetic fallback/i);
}

process.stdout.write('Lighthouse live-weather preflight retry contract: PASS (7 scenarios)\n');
