import { describe, expect, it } from 'vitest';
import { europeanAqiToOpenWeatherIndex, getOpenWeatherAqiLabelKey } from '../../utils/airQuality';

describe('European AQI normalization', () => {
  it('maps the documented open-ended European AQI bands to the 1–5 risk scale', () => {
    expect([0, 19.9, 20, 39.9, 40, 59.9, 60, 79.9, 80, 100, 1001].map(europeanAqiToOpenWeatherIndex)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5,
    ]);
  });

  it('does not turn invalid European AQI values into a healthy category', () => {
    expect(europeanAqiToOpenWeatherIndex(-1)).toBeUndefined();
    expect(europeanAqiToOpenWeatherIndex(Number.NaN)).toBeUndefined();
    expect(europeanAqiToOpenWeatherIndex(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe('getOpenWeatherAqiLabelKey', () => {
  it('maps the documented OpenWeather 1-5 qualitative scale', () => {
    expect([1, 2, 3, 4, 5].map(getOpenWeatherAqiLabelKey)).toEqual([
      'airQuality.good',
      'airQuality.fair',
      'airQuality.moderate',
      'airQuality.poor',
      'airQuality.veryPoor',
    ]);
  });

  it('does not fabricate a qualitative category for invalid values', () => {
    expect(getOpenWeatherAqiLabelKey(0)).toBeUndefined();
    expect(getOpenWeatherAqiLabelKey(6)).toBeUndefined();
    expect(getOpenWeatherAqiLabelKey(2.5)).toBeUndefined();
    expect(getOpenWeatherAqiLabelKey(Number.NaN)).toBeUndefined();
  });
});
