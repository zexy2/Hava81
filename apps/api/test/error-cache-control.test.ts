import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app';
import { envSchema } from '../src/config/env';
import { AppError } from '../src/core/errors';
import type {
  AirQualityQuery,
  CurrentWeatherQuery,
  ForecastQuery,
  WeatherProvider,
} from '../src/providers/weather-provider';

class UnusedWeatherProvider implements WeatherProvider {
  readonly name = 'UnusedWeather';

  async getCurrent(_query: CurrentWeatherQuery): Promise<never> {
    throw new Error('unused');
  }

  async getForecast(_query: ForecastQuery): Promise<never> {
    throw new Error('unused');
  }

  async getAirQuality(_query: AirQualityQuery): Promise<never> {
    throw new Error('unused');
  }
}

const createEnv = () =>
  envSchema.parse({
    NODE_ENV: 'test',
    OPENWEATHER_API_KEY: 'server-only-test-key',
    CORS_ORIGINS: 'http://localhost:3000',
  });

test('API error responses explicitly opt out of HTTP caching', async context => {
  const app = await buildApp({
    env: createEnv(),
    provider: new UnusedWeatherProvider(),
    logger: false,
  });
  context.after(() => app.close());

  app.get('/__test/transient-failure', async () => {
    throw new AppError(503, 'TEST_FAILURE', 'Temporary failure');
  });
  app.get('/__test/provider-rate-limited', async () => {
    throw new AppError(503, 'PROVIDER_RATE_LIMITED', 'Provider rate limited', undefined, {
      retryAfterSeconds: 120,
    });
  });

  const validation = await app.inject({ method: 'GET', url: '/api/v1/weather/current' });
  const missing = await app.inject({ method: 'GET', url: '/api/v1/does-not-exist' });
  const transient = await app.inject({ method: 'GET', url: '/__test/transient-failure' });
  const rateLimited = await app.inject({ method: 'GET', url: '/__test/provider-rate-limited' });

  assert.equal(validation.statusCode, 400);
  assert.equal(validation.headers['cache-control'], 'no-store');
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.headers['cache-control'], 'no-store');
  assert.equal(transient.statusCode, 503);
  assert.equal(transient.headers['cache-control'], 'no-store');
  assert.equal(transient.headers['retry-after'], undefined);
  assert.equal(rateLimited.statusCode, 503);
  assert.equal(rateLimited.headers['cache-control'], 'no-store');
  assert.equal(rateLimited.headers['retry-after'], '120');
});
