import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app';
import { envSchema } from '../src/config/env';
import { AppError } from '../src/core/errors';
import { UpstreamBudget } from '../src/core/upstream-budget';
import { PROVINCES } from '../src/modules/provinces/provinces.data';
import {
  OpenMeteoProvincesProvider,
  type ProvinceCurrentObservation,
  type ProvinceCurrentProvider,
  type ProvincePoint,
} from '../src/providers/openmeteo/openmeteo-provinces.provider';
import type { WeatherProvider } from '../src/providers/weather-provider';

const env = envSchema.parse({ NODE_ENV: 'test', OPENWEATHER_API_KEY: 'k' });
const unusedProvider = {} as WeatherProvider;

class FakeProvinces implements ProvinceCurrentProvider {
  readonly name = 'FakeMeteo';
  readonly attribution = 'Fake · test';
  calls = 0;
  fail = false;
  async getCurrent(points: readonly ProvincePoint[]): Promise<Array<ProvinceCurrentObservation | null>> {
    this.calls += 1;
    if (this.fail) throw new AppError(502, 'PROVINCES_PROVIDER_ERROR', 'down');
    return points.map((point, index) =>
      index === 1
        ? null
        : {
            temperature: Math.round(point.lat * 10) / 10,
            weatherCode: 0,
            isDay: true,
            windSpeed: 2.5,
            observedAt: '2026-10-21T12:00:00.000Z',
          },
    );
  }
}

test('81 province list covers every plate exactly once inside Turkey bounds', () => {
  assert.equal(PROVINCES.length, 81);
  assert.deepEqual(
    PROVINCES.map(province => province.plate).sort((a, b) => a - b),
    Array.from({ length: 81 }, (_, index) => index + 1),
  );
  for (const province of PROVINCES) {
    assert.ok(province.lat >= 35.5 && province.lat <= 42.5, province.name);
    assert.ok(province.lon >= 25.5 && province.lon <= 45, province.name);
  }
});

test('provinces endpoint returns live temperatures with one cached upstream call', async t => {
  const provincesProvider = new FakeProvinces();
  const budget = new UpstreamBudget(10);
  const app = await buildApp({ env, provider: unusedProvider, provincesProvider, upstreamBudget: budget, logger: false });
  t.after(() => app.close());

  const first = await app.inject({ method: 'GET', url: '/api/v1/weather/provinces?lang=en' });
  const second = await app.inject({ method: 'GET', url: '/api/v1/weather/provinces?lang=tr' });

  assert.equal(first.statusCode, 200);
  const body = first.json();
  // Bir il için gözlem yoksa listeden çıkarılır, toplam yine 81 olarak bildirilir.
  assert.equal(body.provinces.length, 80);
  assert.equal(body.meta.total, 81);
  assert.equal(body.meta.units, 'metric');
  assert.equal(body.meta.provider, 'FakeMeteo');
  assert.equal(body.meta.cacheStatus, 'MISS');
  const adana = body.provinces.find((province: { plate: number }) => province.plate === 1);
  assert.deepEqual(adana, {
    plate: 1,
    name: 'Adana',
    lat: 37,
    lon: 35.32,
    temperature: 37,
    weatherCode: 0,
    icon: '01d',
    description: 'clear sky',
    windSpeed: 2.5,
    observedAt: '2026-10-21T12:00:00.000Z',
  });
  assert.match(String(first.headers['cache-control']), /^public, max-age=\d+$/);
  assert.equal(second.headers['x-cache'], 'HIT');
  assert.equal(second.json().provinces[0].description, 'açık');
  assert.equal(provincesProvider.calls, 1);
  assert.equal(budget.used, 1);
});

test('provinces endpoint surfaces provider failures as structured errors', async t => {
  const provincesProvider = new FakeProvinces();
  provincesProvider.fail = true;
  const app = await buildApp({ env, provider: unusedProvider, provincesProvider, logger: false });
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/v1/weather/provinces' });
  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error.code, 'PROVINCES_PROVIDER_ERROR');
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('Open-Meteo provinces provider sends one multi-location request and normalizes it', async () => {
  const requests: URL[] = [];
  const fetchImpl = (async (input: Parameters<typeof fetch>[0]) => {
    requests.push(new URL(String(input)));
    return new Response(
      JSON.stringify([
        { current: { time: 1_792_000_000, temperature_2m: 18.36, weather_code: 3, is_day: 0, wind_speed_10m: 4.1 } },
        { current: { time: 1_792_000_000, temperature_2m: null, weather_code: 3, is_day: 1 } },
      ]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
  const provider = new OpenMeteoProvincesProvider(fetchImpl, 1_000, 'https://meteo.test');

  const result = await provider.getCurrent([
    { lat: 41.01, lon: 28.97 },
    { lat: 39.93, lon: 32.86 },
  ]);

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.searchParams.get('latitude'), '41.01,39.93');
  assert.equal(requests[0]?.searchParams.get('longitude'), '28.97,32.86');
  assert.deepEqual(result, [
    {
      temperature: 18.4,
      weatherCode: 3,
      isDay: false,
      windSpeed: 4.1,
      observedAt: new Date(1_792_000_000 * 1_000).toISOString(),
    },
    null,
  ]);
});


test('Open-Meteo provinces provider omits invalid WMO codes, day flags, and timestamps per location', async () => {
  const base = {
    time: 1_792_000_000,
    temperature_2m: 18,
    weather_code: 3,
    is_day: 1,
    wind_speed_10m: 4,
  };
  const invalidCases: Array<{ name: string; current: Record<string, unknown> }> = [
    { name: 'unsupported WMO code', current: { ...base, weather_code: 100 } },
    { name: 'fractional WMO code', current: { ...base, weather_code: 3.5 } },
    { name: 'invalid day flag', current: { ...base, is_day: 2 } },
    { name: 'missing day flag', current: Object.fromEntries(Object.entries(base).filter(([key]) => key !== 'is_day')) },
    { name: 'unrepresentable timestamp', current: { ...base, time: 9_000_000_000_000 } },
  ];

  for (const item of invalidCases) {
    const fetchImpl = (async () =>
      new Response(JSON.stringify([{ current: item.current }]), { status: 200 })) as typeof fetch;
    const provider = new OpenMeteoProvincesProvider(fetchImpl, 1_000, 'https://meteo.test');
    assert.deepEqual(await provider.getCurrent([{ lat: 41, lon: 29 }]), [null], item.name);
  }
});

test('Open-Meteo provinces provider keeps only physically bounded optional wind values', async () => {
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify([
        { current: { time: 1_792_000_000, temperature_2m: 18, weather_code: 3, is_day: 1, wind_speed_10m: 150 } },
        { current: { time: 1_792_000_000, temperature_2m: 18, weather_code: 3, is_day: 1, wind_speed_10m: 150.1 } },
        { current: { time: 1_792_000_000, temperature_2m: 18, weather_code: 3, is_day: 1, wind_speed_10m: -1 } },
      ]),
      { status: 200 },
    )) as typeof fetch;
  const provider = new OpenMeteoProvincesProvider(fetchImpl, 1_000, 'https://meteo.test');

  const result = await provider.getCurrent([
    { lat: 41, lon: 29 },
    { lat: 40, lon: 30 },
    { lat: 39, lon: 31 },
  ]);

  assert.equal(result[0]?.windSpeed, 150);
  assert.equal('windSpeed' in (result[1] ?? {}), false);
  assert.equal('windSpeed' in (result[2] ?? {}), false);
  assert.equal(result[1]?.temperature, 18);
  assert.equal(result[2]?.temperature, 18);
});

test('Open-Meteo provinces provider rejects a mismatched location count', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify([{ current: { time: 1, temperature_2m: 1, weather_code: 0 } }]), {
      status: 200,
    })) as unknown as typeof fetch;
  const provider = new OpenMeteoProvincesProvider(fetchImpl, 1_000, 'https://meteo.test');
  await assert.rejects(
    provider.getCurrent([
      { lat: 41, lon: 29 },
      { lat: 40, lon: 30 },
    ]),
    (error: unknown) => error instanceof AppError && error.code === 'INVALID_PROVINCES_PROVIDER_RESPONSE',
  );
});
