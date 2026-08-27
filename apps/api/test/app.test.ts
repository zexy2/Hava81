import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app';
import { envSchema, type AppConfig } from '../src/config/env';
import { AppError } from '../src/core/errors';
import { OpenWeatherProvider } from '../src/providers/openweather/openweather.provider';
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

const currentFixture: CurrentWeatherUpstream = {
  coord: { lon: 28.97, lat: 41.01 },
  weather: [{ id: 800, main: 'Clear', description: 'açık', icon: '01d' }],
  main: {
    temp: 21.6,
    feels_like: 21.1,
    temp_min: 19.4,
    temp_max: 23.2,
    pressure: 1013,
    humidity: 62,
  },
  visibility: 10_000,
  wind: { speed: 3.2, deg: 180 },
  clouds: { all: 4 },
  dt: 1_720_000_000,
  sys: { country: 'TR', sunrise: 1_719_970_000, sunset: 1_720_020_000 },
  timezone: 10_800,
  id: 745_044,
  name: 'İstanbul',
};

const forecastFixture: ForecastUpstream = {
  cod: '200',
  city: {
    id: 745_044,
    name: 'İstanbul',
    country: 'TR',
    coord: { lon: 28.97, lat: 41.01 },
    timezone: 10_800,
  },
  list: [
    {
      dt: 1_720_000_000,
      dt_txt: '2024-07-03 12:00:00',
      main: currentFixture.main,
      weather: currentFixture.weather,
      clouds: currentFixture.clouds,
      wind: currentFixture.wind,
      visibility: 10_000,
      pop: 0.25,
    },
  ],
};

const airQualityFixture: AirQualityUpstream = {
  coord: currentFixture.coord,
  list: [
    {
      main: { aqi: 2 },
      components: {
        co: 200,
        no: 0.1,
        no2: 5,
        o3: 40,
        so2: 2,
        pm2_5: 8.4,
        pm10: 14.2,
        nh3: 1,
      },
      dt: 1_720_000_000,
    },
  ],
};

class FakeWeatherProvider implements WeatherProvider {
  currentCalls = 0;
  forecastCalls = 0;
  airQualityCalls = 0;

  constructor(private readonly delayMs = 0) {}

  async getCurrent(_query: CurrentWeatherQuery): Promise<CurrentWeatherUpstream> {
    this.currentCalls += 1;
    if (this.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    return currentFixture;
  }

  async getForecast(_query: ForecastQuery): Promise<ForecastUpstream> {
    this.forecastCalls += 1;
    return forecastFixture;
  }

  async getAirQuality(_query: AirQualityQuery): Promise<AirQualityUpstream> {
    this.airQualityCalls += 1;
    return airQualityFixture;
  }
}

const createEnv = (overrides: Partial<Record<string, string | number>> = {}): AppConfig =>
  envSchema.parse({
    NODE_ENV: 'test',
    OPENWEATHER_API_KEY: 'server-only-test-key',
    CORS_ORIGINS: 'http://localhost:3000',
    ...overrides,
  });

test('health endpoints and OpenAPI docs are available', async (context) => {
  const app = await buildApp({ env: createEnv(), provider: new FakeWeatherProvider(), logger: false });
  context.after(() => app.close());

  const live = await app.inject({ method: 'GET', url: '/api/v1/health/live' });
  const ready = await app.inject({ method: 'GET', url: '/api/v1/health/ready' });
  const docs = await app.inject({ method: 'GET', url: '/docs/json' });

  assert.equal(live.statusCode, 200);
  assert.deepEqual(live.json(), { status: 'ok' });
  assert.equal(live.headers['x-content-type-options'], 'nosniff');
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.json().status, 'ready');
  assert.equal(docs.statusCode, 200);
  assert.ok(docs.json().paths['/api/v1/weather/current']);
});

test('current endpoint validates input and returns a normalized response', async (context) => {
  const provider = new FakeWeatherProvider();
  const app = await buildApp({ env: createEnv(), provider, logger: false });
  context.after(() => app.close());

  const invalid = await app.inject({ method: 'GET', url: '/api/v1/weather/current' });
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/weather/current?city=%C4%B0stanbul&lang=tr&units=metric',
  });

  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, 'VALIDATION_ERROR');
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().cityName, 'İstanbul');
  assert.equal(response.json().temperature, 22);
  assert.match(response.json().timestamp, /^2024-/);
  assert.equal(provider.currentCalls, 1);
  assert.equal(JSON.stringify(response.json()).includes('server-only-test-key'), false);
});

test('cache returns hits and coalesces concurrent upstream requests', async (context) => {
  const provider = new FakeWeatherProvider(20);
  const app = await buildApp({ env: createEnv(), provider, logger: false });
  context.after(() => app.close());
  const url = '/api/v1/weather/current?city=Ankara';

  const [first, concurrent] = await Promise.all([
    app.inject({ method: 'GET', url }),
    app.inject({ method: 'GET', url }),
  ]);
  const cached = await app.inject({ method: 'GET', url });

  assert.deepEqual(
    [first.headers['x-cache'], concurrent.headers['x-cache']].sort(),
    ['COALESCED', 'MISS'],
  );
  assert.equal(cached.headers['x-cache'], 'HIT');
  assert.equal(provider.currentCalls, 1);
});

test('forecast and air-quality endpoints normalize provider data', async (context) => {
  const provider = new FakeWeatherProvider();
  const app = await buildApp({ env: createEnv(), provider, logger: false });
  context.after(() => app.close());

  const forecast = await app.inject({
    method: 'GET',
    url: '/api/v1/weather/forecast?lat=41.01&lon=28.97',
  });
  const airQuality = await app.inject({
    method: 'GET',
    url: '/api/v1/weather/air-quality?lat=41.01&lon=28.97&lang=en',
  });

  assert.equal(forecast.statusCode, 200);
  assert.equal(forecast.json().daily[0].pop, 25);
  assert.equal(forecast.json().hourly[0].temp, 22);
  assert.equal(airQuality.statusCode, 200);
  assert.equal(airQuality.json().aqiLabel, 'Fair');
  assert.equal(provider.forecastCalls, 1);
  assert.equal(provider.airQualityCalls, 1);
});

test('rate limiter returns the structured error envelope', async (context) => {
  const app = await buildApp({
    env: createEnv({ RATE_LIMIT_MAX: 2 }),
    provider: new FakeWeatherProvider(),
    logger: false,
  });
  context.after(() => app.close());

  const url = '/api/v1/weather/current?city=%C4%B0zmir';
  await app.inject({ method: 'GET', url });
  await app.inject({ method: 'GET', url });
  const limited = await app.inject({ method: 'GET', url });

  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error.code, 'RATE_LIMITED');
  assert.ok(limited.json().error.requestId);
});

test('OpenWeather adapter rejects malformed upstream responses', async () => {
  const fakeFetch = (async () =>
    new Response(JSON.stringify({ unexpected: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  const provider = new OpenWeatherProvider(createEnv(), fakeFetch);

  await assert.rejects(
    () => provider.getCurrent({ city: 'İzmir', units: 'metric', lang: 'tr' }),
    (error: unknown) => error instanceof AppError && error.code === 'INVALID_PROVIDER_RESPONSE',
  );
});


test('OpenWeather forecast accepts entries without optional visibility', async () => {
  const payload = structuredClone(forecastFixture);
  delete payload.list[0].visibility;

  const fakeFetch = (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  const provider = new OpenWeatherProvider(createEnv(), fakeFetch);

  const result = await provider.getForecast({
    lat: 41.01,
    lon: 28.97,
    units: 'metric',
    lang: 'tr',
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].visibility, undefined);
});
