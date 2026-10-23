import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenMeteoAirQualityHourlyProvider } from '../src/providers/openmeteo/openmeteo-air-quality-hourly.provider';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('Open-Meteo air-quality adapter requests hourly European AQI and PM2.5 for 120 hours', async () => {
  let requested: URL | undefined;
  const fakeFetch = (async (input: string | URL | Request) => {
    requested = new URL(String(input));
    return json({
      hourly: {
        time: [1787936400, 1787940000, 1787943600, 1787947200],
        european_aqi: [42.4, 61, null, -3],
        pm2_5: [12.34, null, 9, 4],
      },
    });
  }) as typeof fetch;

  const provider = new OpenMeteoAirQualityHourlyProvider(fakeFetch, 1_000, 'https://aq.example.test', 'key');
  const result = await provider.getAirQualityHourly({ lat: 41.01, lon: 28.97 });

  assert.equal(requested?.hostname, 'aq.example.test');
  assert.equal(requested?.pathname, '/v1/air-quality');
  assert.equal(requested?.searchParams.get('hourly'), 'european_aqi,pm2_5');
  assert.equal(requested?.searchParams.get('forecast_hours'), '120');
  assert.equal(requested?.searchParams.get('timeformat'), 'unixtime');
  assert.equal(requested?.searchParams.get('apikey'), 'key');
  // Hours without a (valid) modelled AQI are omitted; PM2.5 is optional.
  assert.deepEqual(result.hourly, [
    { time: new Date(1787936400 * 1000).toISOString(), europeanAqi: 42, pm25: 12.3 },
    { time: new Date(1787940000 * 1000).toISOString(), europeanAqi: 61 },
  ]);
});

test('Open-Meteo air-quality adapter rejects inconsistent, empty and failed responses', async () => {
  const cases: Array<[unknown, number, string]> = [
    [{ hourly: { time: [1, 2], european_aqi: [10] } }, 200, 'INVALID_AIR_QUALITY_HOURLY_PROVIDER_RESPONSE'],
    [{ hourly: { time: [2, 1], european_aqi: [10, 11] } }, 200, 'INVALID_AIR_QUALITY_HOURLY_PROVIDER_RESPONSE'],
    [{ hourly: { time: [1, 2], european_aqi: [null, null] } }, 200, 'EMPTY_AIR_QUALITY_HOURLY_PROVIDER_RESPONSE'],
    [{ nope: true }, 200, 'INVALID_AIR_QUALITY_HOURLY_PROVIDER_RESPONSE'],
    [{}, 500, 'AIR_QUALITY_HOURLY_PROVIDER_ERROR'],
  ];
  for (const [body, status, code] of cases) {
    const provider = new OpenMeteoAirQualityHourlyProvider((async () => json(body, status)) as typeof fetch, 1_000);
    await assert.rejects(provider.getAirQualityHourly({ lat: 41, lon: 29 }), (error: { code?: string }) => {
      assert.equal(error.code, code);
      return true;
    });
  }
});

test('Open-Meteo air-quality adapter preserves European AQI values above the undocumented 1,000 ceiling', async () => {
  const fakeFetch = (async () =>
    json({
      hourly: {
        time: [1787936400, 1787940000],
        european_aqi: [1_001, 100],
        pm2_5: [12, 12],
      },
    })) as typeof fetch;

  const provider = new OpenMeteoAirQualityHourlyProvider(fakeFetch, 1_000);
  const result = await provider.getAirQualityHourly({ lat: 41.01, lon: 28.97 });

  assert.deepEqual(result.hourly, [
    { time: new Date(1787936400 * 1000).toISOString(), europeanAqi: 1_001, pm25: 12 },
    { time: new Date(1787940000 * 1000).toISOString(), europeanAqi: 100, pm25: 12 },
  ]);
});
