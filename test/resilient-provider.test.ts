import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../src/core/errors';
import { ResilientWeatherProvider } from '../src/core/resilient-provider';
import type {
  AirQualityUpstream,
  CurrentWeatherUpstream,
  ForecastUpstream,
} from '../src/providers/openweather/schemas';
import type {
  AirQualityQuery,
  CurrentWeatherQuery,
  ForecastQuery,
  WeatherProvider,
} from '../src/providers/weather-provider';

const currentResult = { name: 'İstanbul' } as CurrentWeatherUpstream;
const forecastResult = { cod: '200', list: [] } as unknown as ForecastUpstream;
const airQualityResult = { list: [] } as unknown as AirQualityUpstream;
const currentQuery: CurrentWeatherQuery = { city: 'İstanbul', units: 'metric', lang: 'tr' };

type CurrentBehavior = () => Promise<CurrentWeatherUpstream>;

class StubProvider implements WeatherProvider {
  readonly name: string;
  currentCalls = 0;

  constructor(name: string, private currentBehavior: CurrentBehavior) {
    this.name = name;
  }

  async getCurrent(_query: CurrentWeatherQuery): Promise<CurrentWeatherUpstream> {
    this.currentCalls += 1;
    return this.currentBehavior();
  }

  async getForecast(_query: ForecastQuery): Promise<ForecastUpstream> {
    return forecastResult;
  }

  async getAirQuality(_query: AirQualityQuery): Promise<AirQualityUpstream> {
    return airQualityResult;
  }
}

const config = { retryCount: 1, failureThreshold: 2, resetMs: 60_000 };

test('retries a retryable primary failure and closes cleanly after recovery', async () => {
  let attempt = 0;
  const primary = new StubProvider('primary', async () => {
    attempt += 1;
    if (attempt === 1) throw new AppError(502, 'UPSTREAM_FAILURE', 'temporary');
    return currentResult;
  });
  const provider = new ResilientWeatherProvider(primary, undefined, config);

  const result = await provider.getCurrent(currentQuery);

  assert.equal(result, currentResult);
  assert.equal(primary.currentCalls, 2);
  assert.deepEqual(provider.getHealth(), {
    name: 'primary',
    state: 'closed',
    consecutiveFailures: 0,
    fallbackConfigured: false,
    lastFailureAt: null,
  });
});

test('does not retry non-retryable provider errors or count them toward the circuit', async () => {
  const primary = new StubProvider('primary', async () => {
    throw new AppError(400, 'UPSTREAM_VALIDATION', 'bad query');
  });
  const provider = new ResilientWeatherProvider(primary, undefined, config);

  await assert.rejects(() => provider.getCurrent(currentQuery), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 400);
    return true;
  });

  assert.equal(primary.currentCalls, 1);
  assert.equal(provider.getHealth().consecutiveFailures, 0);
  assert.equal(provider.getHealth().state, 'closed');
});

test('opens the circuit after repeated primary outages and serves fallback without probing primary', async () => {
  const primary = new StubProvider('primary', async () => {
    throw new AppError(503, 'UPSTREAM_DOWN', 'down');
  });
  const fallback = new StubProvider('fallback', async () => currentResult);
  const provider = new ResilientWeatherProvider(primary, fallback, {
    retryCount: 0,
    failureThreshold: 2,
    resetMs: 60_000,
  });

  await provider.getCurrent(currentQuery);
  await provider.getCurrent(currentQuery);
  const primaryCallsAtOpen = primary.currentCalls;
  const fallbackCallsAtOpen = fallback.currentCalls;

  const result = await provider.getCurrent(currentQuery);
  const health = provider.getHealth();

  assert.equal(result, currentResult);
  assert.equal(primaryCallsAtOpen, 2);
  assert.equal(primary.currentCalls, primaryCallsAtOpen);
  assert.equal(fallback.currentCalls, fallbackCallsAtOpen + 1);
  assert.equal(health.state, 'open');
  assert.equal(health.consecutiveFailures, 2);
  assert.equal(health.fallbackConfigured, true);
  assert.ok(health.lastFailureAt);
});
