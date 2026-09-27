import assert from 'node:assert/strict';
import test from 'node:test';
import { forecastUpstreamSchema } from '../src/providers/openweather/schemas';

test('forecast schema rejects an empty upstream forecast list', () => {
  const result = forecastUpstreamSchema.safeParse({
    cod: '200',
    list: [],
    city: {
      name: 'İstanbul',
      coord: { lon: 28.97, lat: 41.01 },
      country: 'TR',
      timezone: 10_800,
    },
  });

  assert.equal(result.success, false);
});
