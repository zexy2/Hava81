import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const cssRule = (source: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
};

const remFontSize = (rule: string) => {
  const match = rule.match(/font-size:\s*([0-9.]+)rem/);
  return match ? Number.parseFloat(match[1]) : Number.NaN;
};

describe('first-view functional microtype', () => {
  it('keeps the province plate at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/WeatherDecisionField.css', 'utf8');
    expect(remFontSize(cssRule(css, '.hava81-decision-field__plate'))).toBeGreaterThanOrEqual(0.8125);
  });
});
