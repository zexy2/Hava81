import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRouteDistance } from '../src/modules/route/route-weather.routes';
import {
  RouteWeatherService,
  scoreRouteConditions,
} from '../src/modules/route/route-weather.service';
import type { ForecastDto, HourlyForecastDto } from '../src/modules/weather/contracts';

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
const hourlyForecast: HourlyForecastDto = {
  hourly: Array.from({ length: 24 }, (_, i) => ({
    time: new Date(Date.now() + i * 60 * 60_000).toISOString(),
    temp: 22 + i / 10,
    icon: '10d',
    description: 'hafif yağmur',
    pop: 35,
    precipitationMm: 0.8,
    windSpeed: 4,
  })),
  meta: {
    provider: 'hourly-fake',
    fetchedAt: new Date().toISOString(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 1,
  },
};

test('route weather prefers one-hour forecast samples and carries precipitation amount', async () => {
  let hourlyCalls = 0;
  let fallbackCalls = 0;
  const weather = {
    getHourlyForecast: async () => {
      hourlyCalls += 1;
      return { value: hourlyForecast, status: 'MISS' as const };
    },
    getForecast: async () => {
      fallbackCalls += 1;
      return { value: forecast, status: 'MISS' as const };
    },
  };
  const service = new RouteWeatherService(weather as never);
  const result = await service.evaluate({
    origin: { lat: 41.01, lon: 28.97 },
    destination: { lat: 39.93, lon: 32.86 },
    departure: new Date(Date.now() + 30 * 60_000),
    lang: 'tr',
  });
  assert.equal(result.kind, 'corridor-estimate');
  assert.equal(result.segments.length, 5);
  assert.equal(result.segments[0].precipitationMm, 0.8);
  assert.equal(hourlyCalls, 5);
  assert.equal(fallbackCalls, 0);
  assert.ok(result.estimatedDistanceKm > 300);
  assert.ok(result.disclaimer.includes('gerçek yol'));
});

test('route weather falls back to the three-hour forecast when hourly data is unavailable', async () => {
  let fallbackCalls = 0;
  const weather = {
    getHourlyForecast: async () => {
      throw new Error('hourly unavailable');
    },
    getForecast: async () => {
      fallbackCalls += 1;
      return { value: forecast, status: 'MISS' as const };
    },
  };
  const service = new RouteWeatherService(weather as never);
  const result = await service.evaluate({
    origin: { lat: 41.01, lon: 28.97 },
    destination: { lat: 39.93, lon: 32.86 },
    departure: new Date(Date.now() + 30 * 60_000),
    lang: 'tr',
  });

  assert.equal(result.segments.length, 5);
  assert.equal(result.segments[0].precipitationMm, undefined);
  assert.equal(fallbackCalls, 5);
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

test('route score reacts to measured rain even when probability is zero', () => {
  const dry = scoreRouteConditions(22, 0, 3, 0);
  const wet = scoreRouteConditions(22, 0, 3, 5);
  const veryWet = scoreRouteConditions(22, 0, 3, 8);
  assert.ok(dry >= 95);
  assert.ok(wet < dry);
  assert.ok(veryWet <= 35);
});
