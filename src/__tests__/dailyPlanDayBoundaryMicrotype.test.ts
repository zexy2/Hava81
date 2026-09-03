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

describe('Daily Plan local-day boundary microtype', () => {
  it('keeps the local-day boundary at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/DailyPlanPanel.css', 'utf8');
    expect(remFontSize(cssRule(css, '.daily-plan__slot-day'))).toBeGreaterThanOrEqual(0.8125);
  });
});
