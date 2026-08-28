import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenMeteoHourlyProvider } from '../src/providers/openmeteo/openmeteo-hourly.provider';

test('Open-Meteo hourly adapter requests rich one-hour decision data and maps WMO conditions', async () => {
  let requested: URL | undefined;
  const fakeFetch = (async (input: string | URL | Request) => {
    requested = new URL(String(input));
    return new Response(
      JSON.stringify({
        utc_offset_seconds: 10800,
        hourly: {
          time: [1787936400, 1787940000],
          temperature_2m: [24.4, 23.2],
          apparent_temperature: [25.1, 22.4],
          relative_humidity_2m: [58, 72],
          precipitation_probability: [5, 75],
          precipitation: [0, 4.2],
          weather_code: [0, 95],
          wind_speed_10m: [3.2, 5.1],
          wind_gusts_10m: [6.4, 12.8],
          visibility: [24000, 4200],
          uv_index: [5.7, 0],
          is_day: [1, 0],
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  const provider = new OpenMeteoHourlyProvider(fakeFetch, 1_000);
  const result = await provider.getHourly({ lat: 41.01, lon: 28.97, lang: 'tr' });

  assert.equal(requested?.hostname, 'api.open-meteo.com');
  assert.equal(requested?.searchParams.get('forecast_hours'), '48');
  assert.equal(requested?.searchParams.get('timeformat'), 'unixtime');
  assert.equal(requested?.searchParams.get('timezone'), 'auto');
  assert.equal(requested?.searchParams.get('wind_speed_unit'), 'ms');
  const fields = new Set(requested?.searchParams.get('hourly')?.split(','));
  for (const field of [
    'apparent_temperature',
    'relative_humidity_2m',
    'precipitation',
    'wind_gusts_10m',
    'visibility',
    'uv_index',
  ]) {
    assert.equal(fields.has(field), true, `missing ${field}`);
  }

  assert.equal(result.timezoneOffsetSeconds, 10800);
  assert.deepEqual(result.hourly[0], {
    time: new Date(1787936400 * 1000).toISOString(),
    temp: 24.4,
    icon: '01d',
    description: 'açık',
    pop: 5,
    windSpeed: 3.2,
    apparentTemperature: 25.1,
    humidity: 58,
    precipitationMm: 0,
    windGust: 6.4,
    uvIndex: 5.7,
    visibility: 24000,
    weatherCode: 0,
  });
  assert.equal(result.hourly[1].icon, '11n');
  assert.equal(result.hourly[1].description, 'gök gürültülü fırtına');
  assert.equal(result.hourly[1].precipitationMm, 4.2);
  assert.equal(result.hourly[1].weatherCode, 95);
});

test('Open-Meteo hourly adapter keeps the core forecast usable when optional decision fields are null', async () => {
  const fakeFetch = (async () =>
    new Response(
      JSON.stringify({
        utc_offset_seconds: 10800,
        hourly: {
          time: [1787936400],
          temperature_2m: [20],
          apparent_temperature: [null],
          relative_humidity_2m: [null],
          precipitation_probability: [10],
          precipitation: [null],
          weather_code: [2],
          wind_speed_10m: [4],
          wind_gusts_10m: [null],
          visibility: [null],
          uv_index: [null],
          is_day: [1],
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;

  const provider = new OpenMeteoHourlyProvider(fakeFetch, 1_000);
  const result = await provider.getHourly({ lat: 41.01, lon: 28.97, lang: 'tr' });

  assert.equal(result.hourly.length, 1);
  assert.equal(result.hourly[0].temp, 20);
  assert.equal(result.hourly[0].weatherCode, 2);
  assert.equal(result.hourly[0].apparentTemperature, undefined);
  assert.equal(result.hourly[0].uvIndex, undefined);
});


test('Open-Meteo hourly adapter supports the paid customer host and API key without changing request semantics', async () => {
  let requested: URL | undefined;
  const fakeFetch = (async (input: string | URL | Request) => {
    requested = new URL(String(input));
    return new Response(
      JSON.stringify({
        utc_offset_seconds: 10800,
        hourly: {
          time: [1787936400],
          temperature_2m: [24],
          apparent_temperature: [24],
          relative_humidity_2m: [50],
          precipitation_probability: [0],
          precipitation: [0],
          weather_code: [0],
          wind_speed_10m: [2],
          wind_gusts_10m: [4],
          visibility: [20000],
          uv_index: [5],
          is_day: [1],
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  const provider = new OpenMeteoHourlyProvider(
    fakeFetch,
    1_000,
    'https://customer-api.open-meteo.com',
    'paid-test-key',
  );
  await provider.getHourly({ lat: 41.01, lon: 28.97, lang: 'tr' });

  assert.equal(requested?.hostname, 'customer-api.open-meteo.com');
  assert.equal(requested?.pathname, '/v1/forecast');
  assert.equal(requested?.searchParams.get('apikey'), 'paid-test-key');
  assert.equal(requested?.searchParams.get('forecast_hours'), '48');
});
