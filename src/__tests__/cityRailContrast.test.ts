import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

// Faz 2.1: the header navigation pass now lives in the shell and city-tab stylesheets.
const css = [readCss('src/styles/App.css'), readCss('src/components/CityTabs.css')].join('\n');
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
};
const hex = (value: string) => {
  const n = Number.parseInt(value.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const luminance = ([r, g, b]: number[]) => {
  const c = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [l1, l2] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

describe('favorite city rail on the navy header (Faz 0.3)', () => {
  it('uses light on-dark text for tabs in every theme', () => {
    expect(css).toMatch(/--city-rail-on-dark:\s*#f2f9ff/);
    expect(rule('.app .atlas-city-rail .city-tabs__item')).toMatch(
      /color:\s*var\(--city-rail-on-dark\)/
    );
    expect(rule('.app .atlas-city-rail .city-tabs__item.active')).toMatch(/color:\s*#fff/);
  });

  it('meets WCAG AA 4.5:1 against every stop of the header gradient', () => {
    for (const stop of ['#102a50', '#123d67', '#14677e']) {
      expect(contrast('#f2f9ff', stop)).toBeGreaterThanOrEqual(4.5);
      expect(contrast('#8fd3ff', stop)).toBeGreaterThanOrEqual(3);
    }
  });
});
