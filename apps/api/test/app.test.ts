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
  HourlyForecastProvider,
  HourlyForecastQuery,
  HourlyForecastProviderResult,
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
      main: { aqi: 3 },
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

class FakeHourlyForecastProvider implements HourlyForecastProvider {
  readonly name = 'FakeHourly';
  readonly attribution = 'FakeHourly · test';
  readonly sourceUrl = 'https://example.test/hourly';
  calls = 0;

  async getHourly(_query: HourlyForecastQuery): Promise<HourlyForecastProviderResult> {
    this.calls += 1;
    return {
      timezoneOffsetSeconds: 10_800,
      daily: [
        {
          date: '2026-08-29',
          tempMin: 20,
          tempMax: 24.6,
          icon: '04d',
          description: 'kapalı',
          pop: 23,
        },
      ],
      hourly: [
        {
          time: '2026-08-28T18:00:00.000Z',
          temp: 24,
          icon: '01d',
          description: 'açık',
          pop: 10,
          windSpeed: 3.4,
          apparentTemperature: 25.2,
          humidity: 58,
          precipitationMm: 0,
          windGust: 6.8,
          uvIndex: 5.4,
          visibility: 24000,
          weatherCode: 0,
        },
        {
          time: '2026-08-28T19:00:00.000Z',
          temp: 23,
          icon: '02n',
          description: 'çoğunlukla açık',
          pop: 15,
          windSpeed: 3.1,
        },
      ],
    };
  }
}

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
  assert.equal(live.headers['cache-control'], 'no-store');
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.headers['cache-control'], 'no-store');
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

test('current endpoint remains available when upstream omits visibility', async (context) => {
  class MissingVisibilityProvider extends FakeWeatherProvider {
    override async getCurrent(_query: CurrentWeatherQuery): Promise<CurrentWeatherUpstream> {
      const payload = structuredClone(currentFixture);
      delete payload.visibility;
      return payload;
    }
  }

  const app = await buildApp({
    env: createEnv(),
    provider: new MissingVisibilityProvider(),
    logger: false,
  });
  context.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/weather/current?city=Tokat&lang=tr&units=metric',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().cityName, 'İstanbul');
  assert.equal('visibility' in response.json(), false);
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

test('weather freshness metadata follows the configured server cache TTLs', async (context) => {
  const app = await buildApp({
    env: createEnv({
      CACHE_CURRENT_TTL_MS: 7_000,
      CACHE_FORECAST_TTL_MS: 11_000,
      CACHE_AIR_QUALITY_TTL_MS: 13_000,
    }),
    provider: new FakeWeatherProvider(),
    hourlyProvider: new FakeHourlyForecastProvider(),
    logger: false,
  });
  context.after(() => app.close());

  const [current, forecast, hourly, airQuality] = await Promise.all([
    app.inject({ method: 'GET', url: '/api/v1/weather/current?city=Ankara' }),
    app.inject({ method: 'GET', url: '/api/v1/weather/forecast?lat=41.01&lon=28.97' }),
    app.inject({ method: 'GET', url: '/api/v1/weather/hourly?lat=41.01&lon=28.97&lang=tr' }),
    app.inject({ method: 'GET', url: '/api/v1/weather/air-quality?lat=41.01&lon=28.97&lang=tr' }),
  ]);

  assert.equal(current.json().meta.freshForSeconds, 7);
  assert.equal(forecast.json().meta.freshForSeconds, 11);
  assert.equal(hourly.json().meta.freshForSeconds, 11);
  assert.equal(airQuality.json().meta.freshForSeconds, 13);
  const assertCacheMaxAgeWithinFreshness = (header: string | undefined, freshForSeconds: number) => {
    assert.ok(header, 'cache-control header is present');
    const match = /^public, max-age=(\d+)$/.exec(header);
    assert.ok(match, `unexpected cache-control header: ${header}`);
    const maxAge = Number(match[1]);
    assert.ok(maxAge >= 0, 'cache max-age is non-negative');
    assert.ok(
      maxAge <= freshForSeconds,
      `cache max-age ${maxAge}s must not exceed ${freshForSeconds}s server freshness`,
    );
  };

  assertCacheMaxAgeWithinFreshness(current.headers['cache-control'], 7);
  assertCacheMaxAgeWithinFreshness(forecast.headers['cache-control'], 11);
  assertCacheMaxAgeWithinFreshness(hourly.headers['cache-control'], 11);
  assertCacheMaxAgeWithinFreshness(airQuality.headers['cache-control'], 13);
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
  assert.equal(airQuality.json().aqiLabel, 'Moderate');

  const airQualityTr = await app.inject({
    method: 'GET',
    url: '/api/v1/weather/air-quality?lat=41.01&lon=28.97&lang=tr',
  });
  assert.equal(airQualityTr.statusCode, 200);
  assert.equal(airQualityTr.json().aqiLabel, 'Orta');
  assert.equal(provider.forecastCalls, 1);
  assert.equal(provider.airQualityCalls, 2);
});

test('hourly forecast endpoint exposes real one-hour cadence metadata and caches it', async (context) => {
  const hourlyProvider = new FakeHourlyForecastProvider();
  const app = await buildApp({
    env: createEnv(),
    provider: new FakeWeatherProvider(),
    hourlyProvider,
    logger: false,
  });
  context.after(() => app.close());

  const url = '/api/v1/weather/hourly?lat=41.01&lon=28.97&lang=tr';
  const first = await app.inject({ method: 'GET', url });
  const second = await app.inject({ method: 'GET', url });

  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['x-cache'], 'MISS');
  assert.equal(first.json().meta.provider, 'FakeHourly');
  assert.equal(first.json().meta.attribution, 'FakeHourly · test');
  assert.equal(first.json().meta.sourceUrl, 'https://example.test/hourly');
  assert.equal(first.json().meta.intervalHours, 1);
  assert.equal(first.json().meta.timezoneOffsetSeconds, 10_800);
  assert.equal(first.json().daily.length, 1);
  assert.deepEqual(first.json().daily[0], {
    date: '2026-08-29',
    tempMin: 20,
    tempMax: 24.6,
    icon: '04d',
    description: 'kapalı',
    pop: 23,
  });
  assert.equal(first.json().hourly.length, 2);
  assert.equal(first.json().hourly[0].apparentTemperature, 25.2);
  assert.equal(first.json().hourly[0].humidity, 58);
  assert.equal(first.json().hourly[0].precipitationMm, 0);
  assert.equal(first.json().hourly[0].windGust, 6.8);
  assert.equal(first.json().hourly[0].uvIndex, 5.4);
  assert.equal(first.json().hourly[0].visibility, 24000);
  assert.equal(first.json().hourly[0].weatherCode, 0);
  assert.equal(first.json().hourly[1].time, '2026-08-28T19:00:00.000Z');
  assert.equal(second.headers['x-cache'], 'HIT');
  assert.equal(hourlyProvider.calls, 1);
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


test('OpenWeather adapter rejects impossible finite current-weather domains', async () => {
  const cases: Array<[string, (payload: typeof currentFixture) => void]> = [
    ['latitude', (payload) => { payload.coord.lat = 91; }],
    ['humidity', (payload) => { payload.main.humidity = 101; }],
    ['pressure', (payload) => { payload.main.pressure = -1; }],
    ['wind speed', (payload) => { payload.wind.speed = -1; }],
    ['wind direction', (payload) => { payload.wind.deg = 361; }],
    ['cloud cover', (payload) => { payload.clouds.all = 101; }],
    ['visibility', (payload) => { payload.visibility = -1; }],
    ['timezone', (payload) => { payload.timezone = 99_999; }],
  ];

  for (const [label, mutate] of cases) {
    const payload = structuredClone(currentFixture);
    mutate(payload);
    const fakeFetch = (async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    const provider = new OpenWeatherProvider(createEnv(), fakeFetch);

    await assert.rejects(
      () => provider.getCurrent({ city: 'İzmir', units: 'metric', lang: 'tr' }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'INVALID_PROVIDER_RESPONSE',
      `expected invalid ${label} to be rejected`,
    );
  }
});

test('OpenWeather forecast normalizes small model humidity overshoots without weakening current observations', async () => {
  const payload = structuredClone(forecastFixture);
  payload.list[0].main = { ...payload.list[0].main, humidity: 101 };
  const fakeFetch = (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  const provider = new OpenWeatherProvider(createEnv(), fakeFetch);

  const result = await provider.getForecast({ lat: 41.01, lon: 28.97, units: 'metric', lang: 'tr' });
  assert.equal(result.list[0].main.humidity, 100);
});

test('OpenWeather forecast still rejects implausible humidity beyond the numerical tolerance', async () => {
  const payload = structuredClone(forecastFixture);
  payload.list[0].main = { ...payload.list[0].main, humidity: 106 };
  const fakeFetch = (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  const provider = new OpenWeatherProvider(createEnv(), fakeFetch);

  await assert.rejects(
    () => provider.getForecast({ lat: 41.01, lon: 28.97, units: 'metric', lang: 'tr' }),
    (error: unknown) => error instanceof AppError && error.code === 'INVALID_PROVIDER_RESPONSE',
  );
});

test('OpenWeather adapter rejects negative pollutant concentrations', async () => {
  const pollutants = ['co', 'no', 'no2', 'o3', 'so2', 'pm2_5', 'pm10', 'nh3'] as const;

  for (const pollutant of pollutants) {
    const payload = structuredClone(airQualityFixture);
    payload.list[0].components[pollutant] = -0.1;
    const fakeFetch = (async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    const provider = new OpenWeatherProvider(createEnv(), fakeFetch);

    await assert.rejects(
      () => provider.getAirQuality({ lat: 38.42, lon: 27.14 }),
      (error: unknown) => error instanceof AppError && error.code === 'INVALID_PROVIDER_RESPONSE',
      `expected negative ${pollutant} concentration to be rejected`,
    );
  }
});

test('OpenWeather current accepts responses without optional visibility', async () => {
  const payload = structuredClone(currentFixture);
  delete payload.visibility;

  const fakeFetch = (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  const provider = new OpenWeatherProvider(createEnv(), fakeFetch);

  const result = await provider.getCurrent({ city: 'Tokat', units: 'metric', lang: 'tr' });

  assert.equal(result.visibility, undefined);
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
