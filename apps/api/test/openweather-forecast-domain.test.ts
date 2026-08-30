import assert from 'node:assert/strict';
import test from 'node:test';
import { forecastUpstreamSchema } from '../src/providers/openweather/schemas';

const sample = () => ({
  cod: '200',
  list: [
    {
      dt: 1_725_000_000,
      main: {
        temp: 24,
        feels_like: 24,
        temp_min: 23,
        temp_max: 25,
        pressure: 1012,
        humidity: 60,
      },
      weather: [{ id: 800, main: 'Clear', description: 'açık', icon: '01d' }],
      clouds: { all: 10 },
      wind: { speed: 3, deg: 120 },
      visibility: 10_000,
      pop: 0.1,
      dt_txt: '2024-08-29 12:00:00',
    },
  ],
  city: {
    id: 745_044,
    name: 'İstanbul',
    coord: { lon: 28.97, lat: 41.01 },
    country: 'TR',
    timezone: 10_800,
  },
});

test('forecast schema accepts an integer epoch and valid provider timezone offset', () => {
  assert.doesNotThrow(() => forecastUpstreamSchema.parse(sample()));
});

test('forecast schema rejects negative and fractional forecast epochs', () => {
  for (const invalidTimestamp of [-1, 1_725_000_000.5]) {
    const payload = sample();
    payload.list[0].dt = invalidTimestamp;
    assert.throws(() => forecastUpstreamSchema.parse(payload));
  }
});

test('forecast schema rejects impossible provider timezone offsets', () => {
  for (const invalidTimezone of [-43_201, 50_401]) {
    const payload = sample();
    payload.city.timezone = invalidTimezone;
    assert.throws(() => forecastUpstreamSchema.parse(payload));
  }
});
