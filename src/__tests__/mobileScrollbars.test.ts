import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

// Faz 2.1: each rail's rule lives in its component stylesheet.
const css = [
  'src/components/hava81/ForecastAtlas.css',
  'src/components/CityTabs.css',
  'src/components/hava81/DailyPlanPanel.css',
  'src/components/hava81/ActivityPlanner.css',
]
  .map(readCss)
  .join('\n');

describe('mobile native scrollbars (Faz 0.5)', () => {
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
