import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

describe('map province marker microtype', () => {
  it('keeps interactive province codes at or above the 13px-equivalent functional floor', () => {
    const css = readCss('src/components/WeatherMap.css');
    const rule = css.match(/(?:^|\n)\.weather-map__plate-marker span\s*\{([^}]*)\}/)?.[1] ?? '';
    const size = Number.parseFloat(rule.match(/font-size:\s*([0-9.]+)rem/)?.[1] ?? 'NaN');

    expect(size).toBeGreaterThanOrEqual(0.8125);
  });
});
