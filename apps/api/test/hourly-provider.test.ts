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
        daily: {
          time: [1787950800, 1788037200],
          temperature_2m_max: [24.6, 27.5],
          temperature_2m_min: [20, 19.9],
          weather_code: [3, 3],
          precipitation_probability_max: [23, 0],
          precipitation_sum: [1.7, 0],
        },
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
  assert.equal(requested?.searchParams.get('forecast_days'), '5');
  const dailyFields = new Set(requested?.searchParams.get('daily')?.split(','));
  for (const field of [
    'temperature_2m_max',
    'temperature_2m_min',
    'weather_code',
    'precipitation_probability_max',
    'precipitation_sum',
  ]) {
    assert.equal(dailyFields.has(field), true, `missing daily ${field}`);
  }
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
  assert.deepEqual(result.daily?.[0], {
    date: '2026-08-29',
    tempMin: 20,
    tempMax: 24.6,
    icon: '04d',
    description: 'kapalı',
    pop: 23,
    precipitationMm: 1.7,
  });
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

  assert.equal(result.daily, undefined);
  assert.equal(result.hourly.length, 1);
  assert.equal(result.hourly[0].temp, 20);
  assert.equal(result.hourly[0].weatherCode, 2);
  assert.equal(result.hourly[0].apparentTemperature, undefined);
  assert.equal(result.hourly[0].uvIndex, undefined);
});


test('Open-Meteo hourly adapter rejects gaps in required one-hour data instead of mislabeling a sparse series', async () => {
  const fakeFetch = (async () =>
    new Response(
      JSON.stringify({
        utc_offset_seconds: 10800,
        hourly: {
          time: [1787936400, 1787940000, 1787943600],
          temperature_2m: [24, null, 22],
          precipitation_probability: [5, 10, 15],
          weather_code: [0, 1, 2],
          wind_speed_10m: [3, 3, 3],
          is_day: [1, 1, 1],
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;

  const provider = new OpenMeteoHourlyProvider(fakeFetch, 1_000);

  await assert.rejects(
    () => provider.getHourly({ lat: 41.01, lon: 28.97, lang: 'tr' }),
    (error: unknown) => {
      assert.equal(
        (error as { code?: string }).code,
        'NON_CONTIGUOUS_HOURLY_PROVIDER_RESPONSE'
      );
      return true;
    }
  );
});

test('Open-Meteo hourly adapter rejects impossible timezone offsets and negative forecast epochs', async () => {
  const cases = [
    { label: 'timezone offset', utcOffset: 50_401, hourlyTime: 1_787_936_400, dailyTime: 1_787_950_800 },
    { label: 'hourly epoch', utcOffset: 10_800, hourlyTime: -1, dailyTime: 1_787_950_800 },
    { label: 'daily epoch', utcOffset: 10_800, hourlyTime: 1_787_936_400, dailyTime: -1 },
  ];

  for (const item of cases) {
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({
          utc_offset_seconds: item.utcOffset,
          daily: {
            time: [item.dailyTime],
            temperature_2m_max: [28],
            temperature_2m_min: [20],
            weather_code: [0],
            precipitation_probability_max: [10],
          },
          hourly: {
            time: [item.hourlyTime],
            temperature_2m: [24],
            precipitation_probability: [10],
            weather_code: [0],
            wind_speed_10m: [3],
            is_day: [1],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;

    const provider = new OpenMeteoHourlyProvider(fakeFetch, 1_000);

    await assert.rejects(
      () => provider.getHourly({ lat: 41.01, lon: 28.97, lang: 'tr' }),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, 'INVALID_HOURLY_PROVIDER_RESPONSE');
        return true;
      },
      `expected invalid ${item.label} to be rejected`,
    );
  }
});

test('Open-Meteo hourly adapter rejects duplicate or backwards daily timestamps', async () => {
  const cases = [
    { label: 'duplicate', times: [1787950800, 1787950800] },
    { label: 'backwards', times: [1788037200, 1787950800] },
  ];

  for (const item of cases) {
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({
          utc_offset_seconds: 10800,
          daily: {
            time: item.times,
            temperature_2m_max: [28, 27],
            temperature_2m_min: [20, 19],
            weather_code: [0, 1],
            precipitation_probability_max: [10, 20],
          },
          hourly: {
            time: [1787936400],
            temperature_2m: [24],
            precipitation_probability: [10],
            weather_code: [0],
            wind_speed_10m: [3],
            is_day: [1],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;

    const provider = new OpenMeteoHourlyProvider(fakeFetch, 1_000);

    await assert.rejects(
      () => provider.getHourly({ lat: 41.01, lon: 28.97, lang: 'tr' }),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, 'INVALID_HOURLY_PROVIDER_RESPONSE');
        return true;
      },
      "expected malformed daily timestamp ordering to be rejected",
    );
  }
});

test('Open-Meteo hourly adapter rejects unsupported WMO weather codes instead of inventing a generic condition', async () => {
  const cases = [
    { label: 'hourly code', hourlyCode: 4, dailyCode: 0 },
    { label: 'daily code', hourlyCode: 0, dailyCode: 4 },
  ];

  for (const item of cases) {
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({
          utc_offset_seconds: 10800,
          daily: {
            time: [1787950800],
            temperature_2m_max: [28],
            temperature_2m_min: [20],
            weather_code: [item.dailyCode],
            precipitation_probability_max: [10],
          },
          hourly: {
            time: [1787936400],
            temperature_2m: [24],
            precipitation_probability: [10],
            weather_code: [item.hourlyCode],
            wind_speed_10m: [3],
            is_day: [1],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;

    const provider = new OpenMeteoHourlyProvider(fakeFetch, 1_000);

    await assert.rejects(
      () => provider.getHourly({ lat: 41.01, lon: 28.97, lang: 'tr' }),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, 'INVALID_HOURLY_PROVIDER_RESPONSE');
        return true;
      },
      `expected unsupported ${item.label} to be rejected`,
    );
  }
});

test('Open-Meteo hourly adapter rejects impossible finite core forecast values', async () => {
  const cases = [
    { label: 'temperature', temperature: 999, pop: 10, windSpeed: 3 },
    { label: 'precipitation probability', temperature: 24, pop: 150, windSpeed: 3 },
    { label: 'wind speed', temperature: 24, pop: 10, windSpeed: -1 },
  ];

  for (const item of cases) {
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({
          utc_offset_seconds: 10800,
          hourly: {
            time: [1787936400],
            temperature_2m: [item.temperature],
            precipitation_probability: [item.pop],
            weather_code: [0],
            wind_speed_10m: [item.windSpeed],
            is_day: [1],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;

    const provider = new OpenMeteoHourlyProvider(fakeFetch, 1_000);

    await assert.rejects(
      () => provider.getHourly({ lat: 41.01, lon: 28.97, lang: 'tr' }),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, 'INVALID_HOURLY_PROVIDER_RESPONSE');
        return true;
      },
      `expected invalid ${item.label} to be rejected`,
    );
  }
});

test('Open-Meteo hourly adapter omits impossible optional decision fields instead of scoring them', async () => {
  const fakeFetch = (async () =>
    new Response(
      JSON.stringify({
        utc_offset_seconds: 10800,
        daily: {
          time: [1787950800],
          temperature_2m_max: [-120],
          temperature_2m_min: [30],
          weather_code: [3],
          precipitation_probability_max: [150],
        },
        hourly: {
          time: [1787936400],
          temperature_2m: [24],
          apparent_temperature: [999],
          relative_humidity_2m: [150],
          precipitation_probability: [10],
          precipitation: [-1],
          weather_code: [0],
          wind_speed_10m: [3],
          wind_gusts_10m: [-4],
          visibility: [-1],
          uv_index: [-2],
          is_day: [1],
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;

  const provider = new OpenMeteoHourlyProvider(fakeFetch, 1_000);
  const result = await provider.getHourly({ lat: 41.01, lon: 28.97, lang: 'tr' });

  assert.equal(result.daily, undefined);
  assert.deepEqual(result.hourly[0], {
    time: new Date(1787936400 * 1000).toISOString(),
    temp: 24,
    icon: '01d',
    description: 'açık',
    pop: 10,
    windSpeed: 3,
    apparentTemperature: undefined,
    humidity: undefined,
    precipitationMm: undefined,
    windGust: undefined,
    uvIndex: undefined,
    visibility: undefined,
    weatherCode: 0,
  });
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
