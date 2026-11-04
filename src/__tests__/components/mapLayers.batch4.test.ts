/**
 * Contract for the batch-4 map fixes (PR #1743). Each test names the issue it closes.
 *
 * FROZEN: written before the implementation and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it.
 */
import { describe, expect, it } from 'vitest';
import type { ProvinceTemperature } from '../../api/weatherService';
import { TURKISH_CITIES } from '../../constants/cities';
import {
  FIELD_MAX_DISTANCE_DEGREES,
  interpolate,
  layerCoverage,
  MIN_FIELD_REGIONS,
  MIN_FIELD_SAMPLES,
  precipitationMeasure,
} from '../../components/map/layers/layerModel';

const province = (
  plate: number,
  overrides: Partial<ProvinceTemperature> = {}
): ProvinceTemperature => {
  const city = TURKISH_CITIES.find(entry => entry.plateCode === plate);
  if (!city) throw new Error(`no plate ${plate}`);
  return {
    plate,
    name: city.name,
    lat: city.coordinates.lat,
    lon: city.coordinates.lon,
    temperature: 15,
    icon: '02d',
    description: 'az bulutlu',
    observedAt: new Date(),
    ...overrides,
  };
};
const all = (overrides: Partial<ProvinceTemperature> = {}) =>
  TURKISH_CITIES.map(city => province(city.plateCode, overrides));

describe('map layers, batch 4', () => {
  // #1720
  it('#1720 a field needs enough provinces spread over enough regions', () => {
    expect(MIN_FIELD_SAMPLES).toBeGreaterThanOrEqual(20);
    expect(MIN_FIELD_REGIONS).toBeGreaterThanOrEqual(4);

    const full = layerCoverage(all(), 'temperature', 0);
    expect(full).toMatchObject({ available: 81, total: 81, drawable: true });

    // All 29 Marmara and Black Sea provinces: enough count, but only two regions.
    const north = TURKISH_CITIES.filter(
      city => city.region === 'Marmara' || city.region === 'Karadeniz'
    ).map(city => province(city.plateCode));
    expect(north.length).toBe(29);
    const clustered = layerCoverage(north, 'temperature', 0);
    expect(clustered.available).toBe(north.length);
    expect(clustered.drawable).toBe(false);

    // Five provinces over five regions: spread, but too few.
    const sparse = [1, 6, 34, 35, 61].map(plate => province(plate));
    expect(layerCoverage(sparse, 'temperature', 0).drawable).toBe(false);
  });

  it('#1720 the field stays empty far from every province instead of copying a distant value', () => {
    expect(FIELD_MAX_DISTANCE_DEGREES).toBeLessThanOrEqual(2);
    const samples = [{ lat: 41.0, lon: 29.0, value: 10 }];
    expect(interpolate(samples, 41.0, 29.0)).toBe(10);
    expect(interpolate(samples, 41.2, 29.3)).toBe(10);
    // Van is ~14° east of İstanbul.
    expect(interpolate(samples, 38.5, 43.4)).toBeNull();
  });

  it('#1720 #1732 missing provinces are counted, never filled with a calm value', () => {
    const provinces = all().map(entry =>
      entry.plate === 34 ? { ...entry, windSpeed: undefined } : { ...entry, windSpeed: 4 }
    );
    const coverage = layerCoverage(provinces, 'wind', 0);
    expect(coverage.available).toBe(80);
    expect(coverage.missing).toBe(1);
    expect(coverage.total).toBe(81);
  });

  // #1728
  it('#1728 precipitation reads a chance only when most provinces report one', () => {
    // One province with a chance, eighty with an amount: the layer reads the amount.
    const mostlyAmount = all({ precipitation: 0.4 }).map(entry =>
      entry.plate === 6 ? { ...entry, precipitationProbability: 40 } : entry
    );
    expect(precipitationMeasure(mostlyAmount)).toBe('amount');
    expect(layerCoverage(mostlyAmount, 'precipitation', 0, 'amount').available).toBe(81);

    const chance = all({ precipitationProbability: 30 });
    expect(precipitationMeasure(chance)).toBe('chance');

    // Neither reported: the layer is unavailable, not dry.
    const neither = all();
    const coverage = layerCoverage(neither, 'precipitation', 0, precipitationMeasure(neither));
    expect(coverage.available).toBe(0);
    expect(coverage.drawable).toBe(false);
  });
});
