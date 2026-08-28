import assert from 'node:assert/strict';
import test from 'node:test';
import { ContextSignalsService } from '../src/modules/context/context.service';

const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
  const url = String(input);
  if (url.includes('air-quality')) {
    return new Response(
      JSON.stringify({
        timezone: 'Europe/Istanbul',
        hourly_units: { dust: 'μg/m³', grass_pollen: 'grains/m³', olive_pollen: 'grains/m³' },
        hourly: {
          time: ['a', 'b'],
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
      current_units: { wave_height: 'm', sea_surface_temperature: '°C' },
      current: { time: '2026-08-28T03:30', wave_height: 0.4, sea_surface_temperature: 25.1 },
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
  assert.equal(result.marine?.seaSurfaceTemperature, 25.1);
});
