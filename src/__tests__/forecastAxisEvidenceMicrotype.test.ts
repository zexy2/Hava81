import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

const css = readCss('src/components/hava81/ForecastAtlas.css');

describe('forecast axis evidence microtype', () => {
  it('keeps temperature-axis evidence at the functional-copy floor', () => {
    const axisLabel = css.match(/\.hava81-forecast-atlas__axis-label\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(axisLabel).toMatch(/font-size:\s*0\.8125rem/);
  });
});
