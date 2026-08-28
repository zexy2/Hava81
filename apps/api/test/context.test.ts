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
