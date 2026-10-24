import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app';
import { envSchema } from '../src/config/env';
import { AppError } from '../src/core/errors';
import { ResilientWeatherProvider } from '../src/core/resilient-provider';
import { OpenWeatherProvider } from '../src/providers/openweather/openweather.provider';

const providerForRetryAfter = (retryAfter: string, onRequest?: () => void) => {
  const fakeFetch = (async () => {
    onRequest?.();
    return new Response(JSON.stringify({ message: 'rate limited' }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': retryAfter },
    });
  }) as typeof fetch;

  return new OpenWeatherProvider(
    {
      OPENWEATHER_API_KEY: 'test-key',
      OPENWEATHER_BASE_URL: 'https://api.openweathermap.org/data/2.5',
      OPENWEATHER_TIMEOUT_MS: 1_000,
    },
    fakeFetch,
  );
};

const requestCurrent = (provider: OpenWeatherProvider) =>
  provider.getCurrent({ city: 'İzmir', units: 'metric', lang: 'tr' });

test('OpenWeather 429 preserves a positive Retry-After delay without retrying', async () => {
  let requestCount = 0;
  const provider = providerForRetryAfter('120', () => { requestCount += 1; });

  await assert.rejects(requestCurrent(provider), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 503);
    assert.equal(error.code, 'PROVIDER_RATE_LIMITED');
    assert.equal(error.retryAfterSeconds, 120);
    return true;
  });
  assert.equal(requestCount, 1);
});

test('OpenWeather 429 converts a future HTTP-date Retry-After to a positive delay', async () => {
  const provider = providerForRetryAfter(new Date(Date.now() + 65_000).toUTCString());

  await assert.rejects(requestCurrent(provider), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.ok(typeof error.retryAfterSeconds === 'number');
    assert.ok(error.retryAfterSeconds > 0 && error.retryAfterSeconds <= 65);
    return true;
  });
});

test('OpenWeather 429 ignores malformed, zero, negative and unsafe Retry-After values', async () => {
  for (const header of ['not-a-date', '0', '-1', '999999999999999999999']) {
    const provider = providerForRetryAfter(header);

    await assert.rejects(requestCurrent(provider), (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'PROVIDER_RATE_LIMITED');
      assert.equal(error.retryAfterSeconds, undefined);
      return true;
    });
  }
});


test('API exposes Retry-After on a provider 429 and makes only one upstream request', async context => {
  const env = envSchema.parse({
    NODE_ENV: 'test',
    OPENWEATHER_API_KEY: 'test-key',
    CORS_ORIGINS: 'http://localhost:3000',
  });
  let requestCount = 0;
  const fakeFetch = (async () => {
    requestCount += 1;
    return new Response(JSON.stringify({ message: 'rate limited' }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': '120' },
    });
  }) as typeof fetch;
  const primary = new OpenWeatherProvider(env, fakeFetch);
  const provider = new ResilientWeatherProvider(primary, undefined, {
    retryCount: 2,
    failureThreshold: 2,
    resetMs: 60_000,
  });
  const app = await buildApp({ env, provider, logger: false });
  context.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/weather/current?city=%C4%B0zmir',
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['retry-after'], '120');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.json().error.code, 'PROVIDER_RATE_LIMITED');
  assert.equal(requestCount, 1);
});
