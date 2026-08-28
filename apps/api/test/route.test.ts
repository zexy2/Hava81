import assert from 'node:assert/strict';
import test from 'node:test';
import { RouteWeatherService } from '../src/modules/route/route-weather.service';
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
