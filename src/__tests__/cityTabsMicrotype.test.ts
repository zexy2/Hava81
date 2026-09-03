import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/components/CityTabs.css', 'utf8');

const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
};

describe('saved city microtype', () => {
  it('keeps province plates at or above the 13px-equivalent floor', () => {
    const match = rule('.city-tabs__plate').match(/font-size:\s*([0-9.]+)rem/);
    expect(match).not.toBeNull();
    expect(Number.parseFloat(match?.[1] ?? '0')).toBeGreaterThanOrEqual(0.8125);
  });
});
