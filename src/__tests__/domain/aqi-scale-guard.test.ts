import { describe, expect, it } from 'vitest';
import { airLevel, europeanAqiLevel } from '../../domain/decision/thresholds';

describe('AQI provider scales stay separate', () => {
  it.each([
    [1, 'fine'],
    [2, 'fine'],
    [3, 'sensitive'],
    [4, 'poor'],
    [5, 'very-poor'],
  ] as const)('maps OpenWeather AQI %i on its 1-5 ordinal scale', (aqi, expected) => {
    expect(airLevel(aqi)).toBe(expected);
  });

  it.each([undefined, 0, -1, 1.5, 6, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'treats invalid OpenWeather AQI %s as unavailable',
    (aqi) => {
      expect(airLevel(aqi)).toBeUndefined();
    },
  );

  it.each([
    [0, 'good'],
    [20, 'good'],
    [20.01, 'fair'],
    [40, 'fair'],
    [40.01, 'moderate'],
    [60, 'moderate'],
    [60.01, 'poor'],
    [80, 'poor'],
    [80.01, 'very-poor'],
    [100, 'very-poor'],
    [100.01, 'extremely-poor'],
    [1000, 'extremely-poor'],
  ] as const)('maps European AQI %i to %s at documented category boundaries', (aqi, expected) => {
    expect(europeanAqiLevel(aqi)).toBe(expected);
  });

  it.each([undefined, -0.01, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'treats invalid European AQI %s as unavailable',
    (aqi) => {
      expect(europeanAqiLevel(aqi)).toBeUndefined();
    },
  );

  it('never interprets the same numeric value using the other provider scale', () => {
    // OpenWeather 5 means its worst category; European AQI 5 is still in the good band.
    expect(airLevel(5)).toBe('very-poor');
    expect(europeanAqiLevel(5)).toBe('good');
    // OpenWeather has no AQI zero category, while European AQI starts at zero.
    expect(airLevel(0)).toBeUndefined();
    expect(europeanAqiLevel(0)).toBe('good');
  });
});
