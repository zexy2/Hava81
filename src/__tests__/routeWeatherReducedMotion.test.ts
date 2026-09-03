import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Route Weather reduced motion', () => {
  it('disables the disclosure chevron transition when reduced motion is requested', () => {
    const css = readFileSync('src/components/hava81/RouteWeatherPanel.css', 'utf8');
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.route-weather__chevron\s*\{[\s\S]*?transition:\s*none;/
    );
  });
});
