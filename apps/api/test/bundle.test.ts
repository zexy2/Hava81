import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app';
import { envSchema, type AppConfig } from '../src/config/env';
import { AppError } from '../src/core/errors';
import { UpstreamBudget } from '../src/core/upstream-budget';
import { ContextSignalsService, type ContextSignals } from '../src/modules/context/context.service';
import type {
  AirQualityUpstream,
  CurrentWeatherUpstream,
  ForecastUpstream,
} from '../src/providers/openweather/schemas';
import type {
  AirQualityHourlyProvider,
  AirQualityHourlyProviderResult,
  CurrentWeatherQuery,
  HourlyForecastProvider,
  HourlyForecastProviderResult,
  WeatherProvider,
} from '../src/providers/weather-provider';

const current: CurrentWeatherUpstream = {
  coord: { lon: 28.97, lat: 41.01 },
  weather: [{ id: 800, main: 'Clear', description: 'açık', icon: '01d' }],
  main: { temp: 21.6, feels_like: 21.1, temp_min: 19.4, temp_max: 23.2, pressure: 1013, humidity: 62 },
  visibility: 10_000,
  wind: { speed: 3.2, deg: 180 },
  clouds: { all: 4 },
  dt: 1_720_000_000,
  sys: { country: 'TR', sunrise: 1_719_970_000, sunset: 1_720_020_000 },
  timezone: 10_800,
  id: 745_044,
  name: 'İstanbul',
};

const forecast: ForecastUpstream = {
  cod: '200',
  city: { id: 745_044, name: 'İstanbul', country: 'TR', coord: current.coord, timezone: 10_800 },
  list: [
    {
      dt: 1_720_000_000,
      dt_txt: '2024-07-03 12:00:00',
      main: current.main,
      weather: current.weather,
      clouds: current.clouds,
      wind: current.wind,
      visibility: 10_000,
      pop: 0.25,
    },
  ],
};

const airQuality: AirQualityUpstream = {
  coord: current.coord,
  list: [
    {
      main: { aqi: 2 },
      components: { co: 200, no: 0.1, no2: 5, o3: 40, so2: 2, pm2_5: 8.4, pm10: 14.2, nh3: 1 },
      dt: 1_720_000_000,
    },
  ],
};

class FakeProvider implements WeatherProvider {
  readonly name = 'Fake';
  calls = { current: 0, forecast: 0, airQuality: 0 };
  failAirQuality = false;
  failAll = false;
  lastCurrentQuery: CurrentWeatherQuery | undefined;

  async getCurrent(query: CurrentWeatherQuery) {
    this.calls.current += 1;
    this.lastCurrentQuery = query;
    if (this.failAll) throw new AppError(502, 'PROVIDER_ERROR', 'down');
    return current;
  }
  async getForecast() {
    this.calls.forecast += 1;
    if (this.failAll) throw new AppError(502, 'PROVIDER_ERROR', 'down');
    return forecast;
  }
  async getAirQuality() {
    this.calls.airQuality += 1;
    if (this.failAll || this.failAirQuality) throw new AppError(502, 'PROVIDER_ERROR', 'aq down');
    return airQuality;
  }
}

class FakeHourly implements HourlyForecastProvider {
  readonly name = 'FakeHourly';
  calls = 0;
  fail = false;
  async getHourly(): Promise<HourlyForecastProviderResult> {
    this.calls += 1;
    if (this.fail) throw new AppError(502, 'HOURLY_PROVIDER_ERROR', 'down');
    return {
      timezoneOffsetSeconds: 10_800,
      daily: [
        {
          date: '2026-08-28',
          tempMin: 19,
          tempMax: 27,
          icon: '01d',
          description: 'açık',
          pop: 10,
          sunrise: '2026-08-28T03:31:00.000Z',
          sunset: '2026-08-28T16:40:00.000Z',
        },
      ],
      hourly: [
        { time: '2026-08-28T18:00:00.000Z', temp: 24, icon: '01n', description: 'açık', pop: 10, windSpeed: 3.4, isDay: false },
      ],
    };
  }
}

class FakeAirHourly implements AirQualityHourlyProvider {
  readonly name = 'Open-Meteo';
  readonly attribution = 'Open-Meteo · CC BY 4.0 · CAMS';
  calls = 0;
  fail = false;
  async getAirQualityHourly(): Promise<AirQualityHourlyProviderResult> {
    this.calls += 1;
    if (this.fail) throw new AppError(502, 'AIR_QUALITY_HOURLY_PROVIDER_ERROR', 'down');
    return {
      hourly: Array.from({ length: 130 }, (_, index) => ({
        time: new Date(Date.parse('2026-08-28T18:00:00.000Z') + index * 3_600_000).toISOString(),
        europeanAqi: 30 + (index % 10),
        pm25: 8.5,
      })),
    };
  }
}

class FakeContext extends ContextSignalsService {
  calls = 0;
  lastMarine: boolean | undefined;
  fail = false;
  override async get(_lat: number, _lon: number, marine: boolean): Promise<ContextSignals> {
    this.calls += 1;
    this.lastMarine = marine;
    if (this.fail) throw new AppError(502, 'CONTEXT_PROVIDER_ERROR', 'down');
    return {
      provider: 'Open-Meteo',
      fetchedAt: new Date().toISOString(),
      attribution: 'Open-Meteo · CC BY 4.0',
      uvIndexMax: 6,
      units: {},
    };
  }
}

const env = (overrides: Record<string, string | number> = {}): AppConfig =>
  envSchema.parse({ NODE_ENV: 'test', OPENWEATHER_API_KEY: 'k', ...overrides });

const setup = async (options: { budget?: UpstreamBudget; overrides?: Record<string, string | number> } = {}) => {
  const provider = new FakeProvider();
  const hourlyProvider = new FakeHourly();
  const contextService = new FakeContext();
  const airQualityHourlyProvider = new FakeAirHourly();
  const app = await buildApp({
    env: env(options.overrides),
    provider,
    hourlyProvider,
    airQualityHourlyProvider,
    contextService,
    upstreamBudget: options.budget,
    logger: false,
  });
  return { app, provider, hourlyProvider, contextService, airQualityHourlyProvider };
};

const URL_BASE = '/api/v1/weather/bundle?lat=41.01&lon=28.97&lang=tr';

test('bundle returns every part in one response with per-part cache metadata', async t => {
  const { app, provider, hourlyProvider, contextService } = await setup();
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: `${URL_BASE}&marine=true` });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.current.cityName, 'İstanbul');
  assert.equal(body.current.temperature, 22);
  assert.equal(body.current.meta.cacheStatus, 'MISS');
  assert.equal(body.forecast.daily[0].pop, 25);
  assert.equal(body.forecast.meta.intervalHours, 3);
  assert.equal(body.hourly.meta.intervalHours, 1);
  assert.equal(body.hourly.hourly[0].temp, 24);
  // Daylight fields survive response serialization (Planla must not recommend night hours).
  assert.equal(body.hourly.hourly[0].isDay, false);
  assert.equal(body.hourly.daily[0].sunrise, '2026-08-28T03:31:00.000Z');
  assert.equal(body.hourly.daily[0].sunset, '2026-08-28T16:40:00.000Z');
  assert.equal(body.airQuality.aqiLabel, 'Makul');
  assert.equal(body.context.uvIndexMax, 6);
  assert.equal(body.context.cacheStatus, 'MISS');
  assert.equal(typeof body.context.freshForSeconds, 'number');
  assert.deepEqual(body.errors, {});
  assert.deepEqual(body.meta.parts, ['current', 'forecast', 'hourly', 'airQuality', 'context']);
  assert.equal(response.headers['x-cache'], 'MISS');
  assert.match(String(response.headers['cache-control']), /^public, max-age=\d+$/);
  // current'ın 60 sn üst sınırı tüm paketi sınırlar.
  assert.ok(Number(String(response.headers['cache-control']).split('=')[1]) <= 60);
  assert.equal(contextService.lastMarine, true);
  assert.deepEqual(provider.lastCurrentQuery, { lat: 41.01, lon: 28.97, units: 'metric', lang: 'tr' });
  assert.deepEqual(provider.calls, { current: 1, forecast: 1, airQuality: 1 });
  assert.equal(hourlyProvider.calls, 1);
});

test('bundle omits airQualityHourly unless requested (plan v3 P1.2: older clients unchanged)', async t => {
  const { app, airQualityHourlyProvider } = await setup();
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: URL_BASE });
  assert.equal(response.statusCode, 200);
  assert.equal('airQualityHourly' in response.json(), false);
  assert.equal(airQualityHourlyProvider.calls, 0);
});

test('bundle serves hourly European AQI for the five-day horizon and caches it (plan v3 P1.2)', async t => {
  const { app, airQualityHourlyProvider } = await setup();
  t.after(() => app.close());

  const url = `${URL_BASE}&include=hourly,airQuality,airQualityHourly`;
  const first = await app.inject({ method: 'GET', url });
  assert.equal(first.statusCode, 200);
  const body = first.json();
  assert.deepEqual(body.errors, {});
  assert.equal(body.airQualityHourly.hourly.length, 120);
  assert.deepEqual(body.airQualityHourly.hourly[0], {
    time: '2026-08-28T18:00:00.000Z',
    europeanAqi: 30,
    pm25: 8.5,
  });
  assert.equal(body.airQualityHourly.meta.provider, 'Open-Meteo');
  assert.equal(body.airQualityHourly.meta.intervalHours, 1);
  assert.equal(body.airQualityHourly.meta.cacheStatus, 'MISS');

  const second = await app.inject({ method: 'GET', url });
  assert.equal(second.json().airQualityHourly.meta.cacheStatus, 'HIT');
  assert.equal(airQualityHourlyProvider.calls, 1);
});

test('bundle reports a failed airQualityHourly part as null with 200 and errors.airQualityHourly', async t => {
  const { app, airQualityHourlyProvider } = await setup();
  airQualityHourlyProvider.fail = true;
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: `${URL_BASE}&include=hourly,airQualityHourly` });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.airQualityHourly, null);
  assert.deepEqual(body.errors.airQualityHourly, {
    code: 'AIR_QUALITY_HOURLY_PROVIDER_ERROR',
    message: 'down',
    statusCode: 502,
  });
  assert.equal(body.hourly.hourly.length, 1);
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('bundle airQualityHourly keeps Turkey bounds and the upstream budget', async t => {
  const { app, airQualityHourlyProvider } = await setup({ budget: new UpstreamBudget(1) });
  t.after(() => app.close());

  const outside = await app.inject({
    method: 'GET',
    url: '/api/v1/weather/bundle?lat=40.71&lon=-74&include=airQualityHourly',
  });
  assert.equal(outside.statusCode, 400);
  assert.equal(airQualityHourlyProvider.calls, 0);

  const first = await app.inject({ method: 'GET', url: `${URL_BASE}&include=airQualityHourly` });
  assert.equal(first.statusCode, 200);
  const exhausted = await app.inject({
    method: 'GET',
    url: '/api/v1/weather/bundle?lat=39.93&lon=32.86&include=airQualityHourly',
  });
  assert.equal(exhausted.statusCode, 503);
  assert.equal(exhausted.json().error.code, 'UPSTREAM_BUDGET_EXHAUSTED');
});

test('bundle shares cache keys with the single endpoints', async t => {
  const { app, provider, hourlyProvider, contextService } = await setup();
  t.after(() => app.close());

  await app.inject({ method: 'GET', url: '/api/v1/weather/forecast?lat=41.01&lon=28.97&lang=tr' });
  await app.inject({ method: 'GET', url: '/api/v1/weather/hourly?lat=41.01&lon=28.97&lang=tr' });
  await app.inject({ method: 'GET', url: '/api/v1/weather/air-quality?lat=41.01&lon=28.97&lang=tr' });
  await app.inject({ method: 'GET', url: '/api/v1/weather/context?lat=41.01&lon=28.97' });

  // 41.014 / 28.973 → aynı 2 haneli cache anahtarı.
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/weather/bundle?lat=41.014&lon=28.973&lang=tr&include=forecast,hourly,airQuality,context',
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['x-cache'], 'HIT');
  assert.equal(response.json().forecast.meta.cacheStatus, 'HIT');
  assert.equal('current' in response.json(), false);
  assert.deepEqual(provider.calls, { current: 0, forecast: 1, airQuality: 1 });
  assert.equal(hourlyProvider.calls, 1);
  assert.equal(contextService.calls, 1);
});

test('bundle include limits the parts and rejects unknown parts', async t => {
  const { app, provider } = await setup();
  t.after(() => app.close());

  const partial = await app.inject({ method: 'GET', url: `${URL_BASE}&include=hourly,airQuality` });
  assert.equal(partial.statusCode, 200);
  assert.deepEqual(Object.keys(partial.json()).sort(), ['airQuality', 'errors', 'hourly', 'meta']);
  assert.equal(provider.calls.forecast, 0);

  const invalid = await app.inject({ method: 'GET', url: `${URL_BASE}&include=hourly,radar` });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, 'VALIDATION_ERROR');
});

test('bundle keeps Turkey bounds validation', async t => {
  const { app, provider } = await setup();
  t.after(() => app.close());

  const newYork = await app.inject({ method: 'GET', url: '/api/v1/weather/bundle?lat=40.71&lon=-74' });
  const missing = await app.inject({ method: 'GET', url: '/api/v1/weather/bundle?lat=41.01' });
  assert.equal(newYork.statusCode, 400);
  assert.equal(newYork.json().error.code, 'VALIDATION_ERROR');
  assert.equal(missing.statusCode, 400);
  assert.deepEqual(provider.calls, { current: 0, forecast: 0, airQuality: 0 });
});

test('bundle reports a failed part as null with its error and is not cached', async t => {
  const { app, provider } = await setup();
  provider.failAirQuality = true;
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: URL_BASE });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.airQuality, null);
  assert.deepEqual(body.errors.airQuality, { code: 'PROVIDER_ERROR', message: 'aq down', statusCode: 502 });
  assert.equal(body.forecast.daily.length, 1);
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('bundle returns the real error status when every part fails', async t => {
  const { app, provider, hourlyProvider, contextService } = await setup();
  provider.failAll = true;
  hourlyProvider.fail = true;
  contextService.fail = true;
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: URL_BASE });
  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error.code, 'PROVIDER_ERROR');
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('bundle cache misses consume the shared upstream budget', async t => {
  // 5 parça = 5 hak; 3 haklık bütçe ile iki parça 503 alır, yanıt yine 200 döner.
  const { app } = await setup({ budget: new UpstreamBudget(3) });
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: URL_BASE });
  assert.equal(response.statusCode, 200);
  const errors = Object.values(response.json().errors) as Array<{ code: string; statusCode: number }>;
  assert.equal(errors.length, 2);
  assert.ok(errors.every(error => error.code === 'UPSTREAM_BUDGET_EXHAUSTED' && error.statusCode === 503));

  const exhausted = await app.inject({
    method: 'GET',
    url: '/api/v1/weather/bundle?lat=39.93&lon=32.86&include=forecast',
  });
  assert.equal(exhausted.statusCode, 503);
  assert.equal(exhausted.json().error.code, 'UPSTREAM_BUDGET_EXHAUSTED');
});

test('bundle and provinces are documented in the OpenAPI schema', async t => {
  const { app } = await setup();
  t.after(() => app.close());

  const docs = await app.inject({ method: 'GET', url: '/docs/json' });
  const paths = docs.json().paths;
  assert.ok(paths['/api/v1/weather/bundle']);
  assert.ok(paths['/api/v1/weather/provinces']);
  const params = paths['/api/v1/weather/bundle'].get.parameters.map((p: { name: string }) => p.name);
  assert.deepEqual(params.sort(), ['include', 'lang', 'lat', 'lon', 'marine', 'units']);
  const provinceItem =
    paths['/api/v1/weather/provinces'].get.responses['200'].content['application/json'].schema.properties
      .provinces.items.properties;
  assert.equal(provinceItem.temperature.minimum, -100);
  assert.equal(provinceItem.temperature.maximum, 100);
  assert.deepEqual(provinceItem.weatherCode.enum, [
    0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82,
    85, 86, 95, 96, 99,
  ]);
  assert.equal(provinceItem.windSpeed.minimum, 0);
  assert.equal(provinceItem.windSpeed.maximum, 150);
});
