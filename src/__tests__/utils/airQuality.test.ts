import { describe, expect, it } from 'vitest';
import { getOpenWeatherAqiLabelKey } from '../../utils/airQuality';

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
