import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRouteDistance } from '../src/modules/route/route-weather.routes';
import { RouteWeatherService, scoreRouteConditions } from '../src/modules/route/route-weather.service';
import type { ForecastDto } from '../src/modules/weather/contracts';

const forecast: ForecastDto = {
  daily: [],
  hourly: Array.from({ length: 8 }, (_, i) => ({
    time: new Date(Date.now() + i * 3 * 60 * 60_000).toISOString(),
    temp: 22 + i,
    icon: '01d',
    description: 'açık',
    pop: i < 2 ? 60 : 5,
    windSpeed: i < 2 ? 12 : 4,
  })),
  meta: {
    provider: 'fake',
    fetchedAt: new Date().toISOString(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 3,
  },
};
const weather = { getForecast: async () => ({ value: forecast, status: 'MISS' as const }) };

test('route weather returns five transparent corridor samples', async () => {
  const service = new RouteWeatherService(weather as never);
  const result = await service.evaluate({
    origin: { lat: 41.01, lon: 28.97 },
    destination: { lat: 39.93, lon: 32.86 },
    departure: new Date(Date.now() + 30 * 60_000),
    lang: 'tr',
  });
  assert.equal(result.kind, 'corridor-estimate');
  assert.equal(result.segments.length, 5);
  assert.ok(result.estimatedDistanceKm > 300);
  assert.ok(result.disclaimer.includes('gerçek yol'));
});


test('route safeguards reject wasteful or meaningless corridors before forecast fan-out', () => {
  assert.throws(() => validateRouteDistance(0.2), /başlangıç ve varış/);
  assert.throws(() => validateRouteDistance(2000.1), /en fazla 2000 km/);
  assert.doesNotThrow(() => validateRouteDistance(1650));
});


test('route score changes smoothly around former hard thresholds', () => {
  const belowHeat = scoreRouteConditions(31.9, 20, 5);
  const aboveHeat = scoreRouteConditions(32.1, 20, 5);
  const belowRain = scoreRouteConditions(24, 49, 5);
  const aboveRain = scoreRouteConditions(24, 51, 5);
  assert.ok(Math.abs(belowHeat - aboveHeat) <= 2);
  assert.ok(Math.abs(belowRain - aboveRain) <= 2);
});

test('route score reflects compound rain and wind risk', () => {
  const calm = scoreRouteConditions(22, 10, 3);
  const rough = scoreRouteConditions(22, 80, 14);
  assert.ok(calm >= 90);
  assert.ok(rough <= 60);
});
