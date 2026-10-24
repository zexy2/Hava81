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

test('forecast schema rejects pressure outside a broad terrestrial hPa envelope', () => {
  for (const pressure of [99, 1_201, 1_000_000]) {
    const payload = sample();
    payload.list[0].main.pressure = pressure;
    assert.throws(() => forecastUpstreamSchema.parse(payload));
  }
});

test('forecast schema rejects unsupported provider icon codes', () => {
  const payload = sample();
  payload.list[0].weather[0].icon = '99d';

  assert.throws(() => forecastUpstreamSchema.parse(payload));
});

test('forecast schema rejects blank provider text fields', () => {
  for (const mutate of [
    (payload: ReturnType<typeof sample>) => {
      payload.list[0].weather[0].main = '   ';
    },
    (payload: ReturnType<typeof sample>) => {
      payload.list[0].weather[0].description = '   ';
    },
    (payload: ReturnType<typeof sample>) => {
      payload.city.name = '   ';
    },
    (payload: ReturnType<typeof sample>) => {
      payload.city.country = '   ';
    },
  ]) {
    const payload = sample();
    mutate(payload);
    assert.throws(() => forecastUpstreamSchema.parse(payload));
  }
});

test('forecast schema rejects negative and fractional forecast epochs', () => {
  for (const invalidTimestamp of [-1, 1_725_000_000.5]) {
    const payload = sample();
    payload.list[0].dt = invalidTimestamp;
    assert.throws(() => forecastUpstreamSchema.parse(payload));
  }
});

test('forecast schema rejects epochs outside the JavaScript Date range', () => {
  const payload = sample();
  payload.list[0].dt = 8_640_000_000_001;
  assert.throws(() => forecastUpstreamSchema.parse(payload));
});

test('forecast schema rejects a missing provider timezone offset', () => {
  const payload = sample();
  delete (payload.city as Partial<typeof payload.city>).timezone;
  assert.throws(() => forecastUpstreamSchema.parse(payload));
});

test('forecast schema rejects impossible provider timezone offsets', () => {
  for (const invalidTimezone of [-43_201, 50_401]) {
    const payload = sample();
    payload.city.timezone = invalidTimezone;
    assert.throws(() => forecastUpstreamSchema.parse(payload));
  }
});

test('forecast schema rejects missing precipitation probability instead of inferring dry weather', () => {
  const payload = sample();
  Reflect.deleteProperty(payload.list[0], 'pop');

  assert.equal(forecastUpstreamSchema.safeParse(payload).success, false);
});

test('forecast schema rejects inverted minimum and maximum temperatures', () => {
  const payload = sample();
  payload.list[0].main.temp_min = 26;
  payload.list[0].main.temp_max = 25;

  assert.equal(forecastUpstreamSchema.safeParse(payload).success, false);
});

test('forecast schema accepts the inclusive precipitation-probability bounds', () => {
  for (const pop of [0, 1]) {
    const payload = sample();
    payload.list[0].pop = pop;

    assert.equal(forecastUpstreamSchema.safeParse(payload).success, true);
  }
});
