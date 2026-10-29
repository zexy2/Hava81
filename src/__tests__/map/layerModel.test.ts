import { describe, expect, it } from 'vitest';
import type { ProvinceTemperature } from '../../api/weatherService';
import {
  downwindRotation,
  interpolate,
  latFromMercatorY,
  layerHasOutlook,
  layerSamples,
  layerValue,
  mercatorY,
  pointInRing,
  rampColor,
} from '../../components/map/layers/layerModel';

const province = (overrides: Partial<ProvinceTemperature> = {}): ProvinceTemperature => ({
  plate: 34,
  name: 'İstanbul',
  lat: 41,
  lon: 29,
  temperature: 16,
  icon: '10d',
  description: 'yağmurlu',
  observedAt: new Date(),
  windSpeed: 6,
  windDirection: 180,
  cloudCover: 90,
  precipitation: 2.4,
  precipitationProbability: 70,
  outlook: [
    { hourOffset: 3, precipitationProbability: 30, temperature: 18 },
    { hourOffset: 6, precipitationProbability: 50, temperature: 15 },
  ],
  ...overrides,
});

describe('map layer model', () => {
  it('reads each layer now and along the outlook', () => {
    const reading = province();
    expect(layerValue(reading, 'precipitation', 0)).toBe(70);
    expect(layerValue(reading, 'precipitation', 3)).toBe(30);
    expect(layerValue(reading, 'temperature', 6)).toBe(15);
    expect(layerValue(reading, 'cloud', 0)).toBe(90);
    expect(layerValue(reading, 'wind', 0)).toBe(6);
    // Wind and cloud have no outlook: the scrubber hour does not apply to them.
    expect(layerHasOutlook('wind')).toBe(false);
    expect(layerValue(reading, 'cloud', 3)).toBe(90);
  });

  it('skips provinces without a reading instead of inventing zero', () => {
    const samples = layerSamples(
      [province(), province({ plate: 6, precipitationProbability: undefined, outlook: undefined })],
      'precipitation',
      0
    );
    expect(samples).toHaveLength(1);
    expect(layerSamples([province({ outlook: undefined })], 'precipitation', 3)).toEqual([]);
  });

  it('interpolates smoothly and passes exactly through each station', () => {
    const samples = [
      { lat: 40, lon: 30, value: 0 },
      { lat: 40, lon: 32, value: 100 },
    ];
    expect(interpolate(samples, 40, 30)).toBe(0);
    expect(interpolate(samples, 40, 32)).toBe(100);
    expect(interpolate(samples, 40, 31)).toBeCloseTo(50, 5);
    const nearLow = interpolate(samples, 40, 30.5) ?? 0;
    expect(nearLow).toBeGreaterThan(0);
    expect(nearLow).toBeLessThan(50);
    expect(interpolate([], 40, 30)).toBeNull();
  });

  it('turns where wind comes from into where it blows', () => {
    expect(downwindRotation(180)).toBe(0);
    expect(downwindRotation(315)).toBe(135);
    expect(downwindRotation(0)).toBe(180);
    expect(downwindRotation(360)).toBe(180);
  });

  it('round-trips latitude through Web Mercator', () => {
    for (const lat of [35.8, 39, 42.15]) {
      expect(latFromMercatorY(mercatorY(lat))).toBeCloseTo(lat, 9);
    }
    expect(mercatorY(42)).toBeGreaterThan(mercatorY(36));
  });

  it('tests points against a ring', () => {
    const square: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(pointInRing(5, 5, square)).toBe(true);
    expect(pointInRing(15, 5, square)).toBe(false);
  });

  it('fades dry and clear areas out and saturates heavy ones', () => {
    expect(rampColor('precipitation', 0)[3]).toBe(0);
    expect(rampColor('precipitation', 90)[3]).toBeGreaterThan(rampColor('precipitation', 40)[3]);
    expect(rampColor('cloud', 0)[3]).toBe(0);
    // Clamped outside the scale.
    expect(rampColor('temperature', -40)).toEqual(rampColor('temperature', -15));
    expect(rampColor('temperature', 60)).toEqual(rampColor('temperature', 40));
  });
});
