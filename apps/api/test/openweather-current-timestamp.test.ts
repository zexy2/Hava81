import assert from 'node:assert/strict';
import test from 'node:test';
import { currentWeatherUpstreamSchema } from '../src/providers/openweather/schemas';

const sample = () => ({
  coord: { lon: 28.97, lat: 41.01 },
  weather: [{ id: 800, main: 'Clear', description: 'açık', icon: '01d' }],
  main: {
    temp: 21.6,
    feels_like: 21.1,
    temp_min: 19.4,
    temp_max: 23.2,
    pressure: 1013,
    humidity: 62,
  },
  visibility: 10_000,
  wind: { speed: 3.2, deg: 180 },
  clouds: { all: 4 },
  dt: Math.floor(Date.now() / 1_000),
  sys: {
    country: 'TR',
    sunrise: Math.floor(Date.now() / 1_000) - 6 * 60 * 60,
    sunset: Math.floor(Date.now() / 1_000) + 6 * 60 * 60,
  },
  timezone: 10_800,
  id: 745_044,
  name: 'İstanbul',
});

test('current-weather schema accepts a current integer observation timestamp', () => {
  assert.doesNotThrow(() => currentWeatherUpstreamSchema.parse(sample()));
});

test('current-weather schema rejects unsupported provider icon codes', () => {
  const payload = sample();
  payload.weather[0].icon = '01x';

  assert.throws(() => currentWeatherUpstreamSchema.parse(payload));
});

test('current-weather schema rejects materially future observation timestamps', () => {
  const payload = sample();
  payload.dt = Math.floor((Date.now() + 2 * 60_000) / 1_000);

  assert.throws(() => currentWeatherUpstreamSchema.parse(payload));
});

test('current-weather schema rejects negative and fractional observation timestamps', () => {
  for (const invalidTimestamp of [-1, 1_720_000_000.5]) {
    const payload = sample();
    payload.dt = invalidTimestamp;
    assert.throws(() => currentWeatherUpstreamSchema.parse(payload));
  }
});

test('current-weather schema rejects a minimum temperature above the maximum', () => {
  const payload = sample();
  payload.main.temp_min = 24;
  payload.main.temp_max = 18;

  assert.throws(() => currentWeatherUpstreamSchema.parse(payload));
});

test('current-weather schema rejects a sunset earlier than sunrise', () => {
  const payload = sample();
  payload.sys.sunrise = 1_720_020_000;
  payload.sys.sunset = 1_719_970_000;

  assert.throws(() => currentWeatherUpstreamSchema.parse(payload));
});

test('current-weather schema rejects negative and fractional sunrise/sunset epochs', () => {
  for (const [field, invalidTimestamp] of [
    ['sunrise', -1],
    ['sunrise', 1_720_000_000.5],
    ['sunset', -1],
    ['sunset', 1_720_000_000.5],
  ] as const) {
    const payload = sample();
    payload.sys[field] = invalidTimestamp;
    assert.throws(() => currentWeatherUpstreamSchema.parse(payload));
  }
});
