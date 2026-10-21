import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

const cssRule = (source: string, selector: string) => {
  // Anchored to a line start: the component's own rule, not an `.app …` override (Faz 2.1).
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
};

const remFontSize = (rule: string) => {
  const match = rule.match(/font-size:\s*([0-9.]+)rem/);
  return match ? Number.parseFloat(match[1]) : Number.NaN;
};

describe('Daily Plan slot microtype', () => {
  it('keeps slot times and the local-day boundary at or above the 13px-equivalent floor', () => {
    const css = readCss('src/components/hava81/DailyPlanPanel.css');
    expect(remFontSize(cssRule(css, '.daily-plan__slot > span'))).toBeGreaterThanOrEqual(0.8125);
    expect(remFontSize(cssRule(css, '.daily-plan__slot-day'))).toBeGreaterThanOrEqual(0.8125);
  });
});
