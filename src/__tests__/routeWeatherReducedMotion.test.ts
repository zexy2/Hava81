import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

describe('Route Weather reduced motion', () => {
  it('disables the disclosure chevron transition when reduced motion is requested', () => {
    const css = readCss('src/components/hava81/RouteWeatherPanel.css');
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.route-weather__chevron\s*\{[\s\S]*?transition:\s*none;/
    );
  });
});
