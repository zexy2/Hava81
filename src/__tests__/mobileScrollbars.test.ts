import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/MobileScrollbars.css', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

describe('mobile native scrollbars (Faz 0.5)', () => {
  it('is imported by the app shell', () => {
    expect(app).toMatch(/import '\.\/styles\/MobileScrollbars\.css';/);
  });

  it('hides native scrollbars on mobile horizontal rails', () => {
    expect(css).toMatch(/@media \(max-width: 47\.99rem\)/);
    for (const rail of [
      'hava81-forecast-atlas__range',
      'hava81-forecast-atlas__hourly-viewport',
      'city-tabs__scroll',
      'daily-plan__slots',
    ]) {
      expect(css).toContain(`.app .${rail}::-webkit-scrollbar`);
    }
    expect(css).toMatch(/scrollbar-width:\s*none/);
  });

  it('wraps the range picker instead of overflowing it', () => {
    expect(css).toMatch(
      /\.app \.hava81-forecast-atlas__range \{[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?overflow-x:\s*visible;/
    );
    expect(css).not.toContain('route-weather__segments');
  });
});
