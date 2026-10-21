import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

const css = readCss('src/components/hava81/ForecastAtlas.css');

describe('Forecast Atlas hourly evidence microtype', () => {
  it('keeps hourly time and precipitation evidence at or above the 13px-equivalent floor', () => {
    const rule =
      css.match(
        /\.hava81-forecast-atlas__hour time,\s*\.hava81-forecast-atlas__hour-pop\s*\{([^}]*)\}/
      )?.[1] ?? '';
    const match = rule.match(/font-size:\s*([0-9.]+)rem/);
    expect(match).not.toBeNull();
    expect(Number.parseFloat(match?.[1] ?? '0')).toBeGreaterThanOrEqual(0.8125);
  });
});
