import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ContextSignalsService,
  finiteMaxForWindow,
  parseGmtModelTime,
} from '../src/modules/context/context.service';

const toGmtModelTime = (date: Date) => date.toISOString().slice(0, 16);

const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
  const url = String(input);
  if (url.includes('air-quality')) {
    const parsedUrl = new URL(url);
    assert.equal(parsedUrl.searchParams.get('timezone'), 'GMT');
    assert.equal(parsedUrl.searchParams.get('forecast_hours'), '25');
    assert.equal(parsedUrl.searchParams.has('forecast_days'), false);
    return new Response(
      JSON.stringify({
        timezone: 'GMT',
        hourly_units: { dust: 'μg/m³', grass_pollen: 'grains/m³', olive_pollen: 'grains/m³' },
        hourly: {
          time: [
            toGmtModelTime(new Date(Date.now() + 60 * 60_000)),
            toGmtModelTime(new Date(Date.now() + 2 * 60 * 60_000)),
          ],
          uv_index: [2, 7],
          dust: [4, 12],
          grass_pollen: [1, 8],
          olive_pollen: [0, 3],
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }
  return new Response(
    JSON.stringify({
      current_units: {
        wave_height: 'm',
        wave_direction: '°',
        wave_period: 's',
        sea_surface_temperature: '°C',
      },
      current: {
        time: '2026-08-28T03:30',
        wave_height: 0.4,
        wave_direction: 315,
        wave_period: 4.8,
        sea_surface_temperature: 25.1,
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}) as typeof fetch;

test('context service normalizes UV, dust, pollen and marine signals', async () => {
  const service = new ContextSignalsService(fakeFetch);
  const result = await service.get(38.42, 27.14, true);
  assert.equal(result.uvIndexMax, 7);
  assert.equal(result.dustMax, 12);
  assert.equal(result.grassPollenMax, 8);
  assert.equal(result.marine?.waveHeight, 0.4);
  assert.equal(result.marine?.waveDirection, 315);
  assert.equal(result.marine?.wavePeriod, 4.8);
  assert.equal(result.marine?.seaSurfaceTemperature, 25.1);
});

test('GMT model timestamps are parsed as UTC even without an explicit offset', () => {
  assert.equal(
    parseGmtModelTime('2026-08-28T11:00'),
    Date.parse('2026-08-28T11:00:00Z')
  );
  assert.equal(
    parseGmtModelTime('2026-08-28T11:00:00+03:00'),
    Date.parse('2026-08-28T11:00:00+03:00')
  );
});

test('context 24h maxima exclude past and beyond-window GMT model slots', () => {
  const now = new Date('2026-08-28T10:00:00Z');
  const times = [
    '2026-08-28T09:00',
    '2026-08-28T11:00',
    '2026-08-29T09:00',
    '2026-08-29T11:00',
  ];
  assert.equal(finiteMaxForWindow(times, [99, 4, 8, 77], now), 8);
});

test('context maxima ignore physically impossible negative modeled values', () => {
  const now = new Date('2026-08-28T10:00:00Z');
  const times = ['2026-08-28T11:00', '2026-08-28T12:00'];

  assert.equal(finiteMaxForWindow(times, [-4, 6], now), 6);
  assert.equal(finiteMaxForWindow(times, [-4, -1], now), undefined);
});

test('context service reports malformed upstream air payloads as provider failures', async () => {
  const malformedAirFetch = (async () =>
    new Response(JSON.stringify({ timezone: 'GMT', hourly: { uv_index: [2, 7] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;

  await assert.rejects(
    () => new ContextSignalsService(malformedAirFetch).get(38.42, 27.14, false),
    (error: unknown) => {
      assert.equal((error as { statusCode?: number }).statusCode, 502);
      assert.equal((error as { code?: string }).code, 'INVALID_CONTEXT_PROVIDER_RESPONSE');
      return true;
    }
  );
});

test('context service rejects malformed or misaligned air-model timelines instead of understating maxima', async () => {
  const cases = [
    {
      label: 'short UV series',
      time: ['2026-08-30T12:00', '2026-08-30T13:00'],
      uvIndex: [2],
    },
    {
      label: 'invalid model time',
      time: ['2026-08-30T12:00', 'not-a-model-time'],
      uvIndex: [2, 7],
    },
  ];

  for (const item of cases) {
    const invalidAirFetch = (async () =>
      new Response(
        JSON.stringify({
          timezone: 'GMT',
          hourly: {
            time: item.time,
            uv_index: item.uvIndex,
            dust: [4, 12],
            grass_pollen: [1, 8],
            olive_pollen: [0, 3],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )) as typeof fetch;

    await assert.rejects(
      () => new ContextSignalsService(invalidAirFetch).get(38.42, 27.14, false),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, 'INVALID_CONTEXT_PROVIDER_RESPONSE');
        return true;
      },
      `expected ${item.label} to fail closed`
    );
  }
});

test('invalid marine physical domains fail closed to air-only context', async () => {
  const invalidMarineFetch = (async (input: Parameters<typeof fetch>[0]) => {
    if (String(input).includes('air-quality')) return fakeFetch(input);
    return new Response(
      JSON.stringify({
        current_units: { wave_height: 'm', wave_direction: '°', wave_period: 's' },
        current: {
          time: '2026-08-28T03:30',
          wave_height: -0.4,
          wave_direction: 361,
          wave_period: 0,
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }) as typeof fetch;

  const result = await new ContextSignalsService(invalidMarineFetch).get(38.42, 27.14, true);

  assert.equal(result.marine, undefined);
  assert.equal(result.uvIndexMax, 7);
});


test('context service supports customer-prefixed Open-Meteo hosts and API keys', async () => {
  const requested: URL[] = [];
  const recordingFetch = (async (input: Parameters<typeof fetch>[0]) => {
    requested.push(new URL(String(input)));
    return fakeFetch(input);
  }) as typeof fetch;

  const service = new ContextSignalsService(recordingFetch, {
    airQualityBaseUrl: 'https://customer-air-quality-api.open-meteo.com',
    marineBaseUrl: 'https://customer-marine-api.open-meteo.com',
    apiKey: 'paid-test-key',
  });
  await service.get(38.42, 27.14, true);

  assert.equal(requested[0]?.hostname, 'customer-air-quality-api.open-meteo.com');
  assert.equal(requested[0]?.pathname, '/v1/air-quality');
  assert.equal(requested[0]?.searchParams.get('apikey'), 'paid-test-key');
  assert.equal(requested[1]?.hostname, 'customer-marine-api.open-meteo.com');
  assert.equal(requested[1]?.pathname, '/v1/marine');
  assert.equal(requested[1]?.searchParams.get('apikey'), 'paid-test-key');
});
