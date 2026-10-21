import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

// Faz 2.1: tokens live in tokens.css, the ring rule in the app shell stylesheet.
const tokens = readCss('src/styles/tokens.css');
const css = readCss('src/styles/App.css');
const entry = readFileSync('src/index.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const hex = (v: string) => {
  const n = Number.parseInt(v.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = (c: number[]) => {
  const [r, g, b] = c.map(x => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const token = (block: RegExp, name: string) =>
  tokens.match(block)?.[1].match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`))?.[1] ?? '#000000';

describe('single focus ring token (Faz 0.6)', () => {
  it('is imported by the app shell and applied to every focusable element', () => {
    expect(entry).toMatch(/import '\.\/styles\/tokens\.css';/);
    expect(app).toMatch(/import '\.\/styles\/App\.css';/);
    expect(css).toMatch(/outline:\s*var\(--focus-ring-width\) solid var\(--focus-ring-color\)/);
  });

  it('keeps ring + halo at >= 3:1 on light cards, navy header and dark surfaces', () => {
    const lightRing = token(/\.app \{([^}]*)\}/, '--focus-ring-color');
    const lightHalo = token(/\.app \{([^}]*)\}/, '--focus-ring-halo');
    const darkRing = token(/\.app\[data-color-mode='dark'\] \{([^}]*)\}/, '--focus-ring-color');
    expect(ratio(lightRing, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(ratio(lightHalo, '#102a50')).toBeGreaterThanOrEqual(3);
    expect(ratio(darkRing, '#0b1a2e')).toBeGreaterThanOrEqual(3);
    expect(ratio(darkRing, '#102a50')).toBeGreaterThanOrEqual(3);
  });
});
