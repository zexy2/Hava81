import assert from 'node:assert/strict';
import test from 'node:test';
import { airQualityUpstreamSchema } from '../src/providers/openweather/schemas';

const sample = () => ({
  coord: { lon: 27.14, lat: 38.42 },
  list: [
    {
      main: { aqi: 3 },
      components: {
        co: 200,
        no: 0.1,
        no2: 5,
        o3: 40,
        so2: 2,
        pm2_5: 8.4,
        pm10: 14.2,
        nh3: 1,
      },
      dt: Math.floor(Date.now() / 1_000),
    },
  ],
});

test('air-quality schema accepts a current integer observation timestamp', () => {
  assert.doesNotThrow(() => airQualityUpstreamSchema.parse(sample()));
});

test('air-quality schema rejects materially future observation timestamps', () => {
  const payload = sample();
  payload.list[0].dt = Math.floor((Date.now() + 2 * 60_000) / 1_000);

  assert.throws(() => airQualityUpstreamSchema.parse(payload));
});

test('air-quality schema rejects negative and fractional observation timestamps', () => {
  for (const invalidTimestamp of [-1, 1_720_000_000.5]) {
    const payload = sample();
    payload.list[0].dt = invalidTimestamp;
    assert.throws(() => airQualityUpstreamSchema.parse(payload));
  }
});
