import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenMeteoHourlyProvider } from '../src/providers/openmeteo/openmeteo-hourly.provider';

test('Open-Meteo hourly adapter requests one-hour data and maps WMO conditions', async () => {
  let requested: URL | undefined;
  const fakeFetch = (async (input: string | URL | Request) => {
    requested = new URL(String(input));
    return new Response(
      JSON.stringify({
        utc_offset_seconds: 10800,
        hourly: {
          time: [1787936400, 1787940000],
          temperature_2m: [24.4, 23.2],
          precipitation_probability: [5, 75],
          weather_code: [0, 95],
          wind_speed_10m: [3.2, 5.1],
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
  assert.equal(result.timezoneOffsetSeconds, 10800);
  assert.deepEqual(result.hourly[0], {
    time: new Date(1787936400 * 1000).toISOString(),
    temp: 24,
    icon: '01d',
    description: 'açık',
    pop: 5,
    windSpeed: 3.2,
  });
  assert.equal(result.hourly[1].icon, '11n');
  assert.equal(result.hourly[1].description, 'gök gürültülü fırtına');
});
