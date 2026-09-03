import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Forecast Atlas interval semantics', () => {
  it('links the interval button group to its visible label', () => {
    const source = readFileSync('src/components/hava81/ForecastAtlas.tsx', 'utf8');
    expect(source).toContain('id={`${id}-interval-label`}');
    expect(source).toContain('aria-labelledby={`${id}-interval-label`}');
    expect(source).not.toContain("aria-label={t('hava81.forecastAtlas.intervalControlLabel')}");
  });
});
