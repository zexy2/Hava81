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

const expectReadableFunctionalMicrotype = (path: string, selector: string) => {
  const css = readFileSync(path, 'utf8');
  expect(remFontSize(cssRule(css, selector))).toBeGreaterThanOrEqual(0.6875);
};

describe('functional microtype readability', () => {
  it('keeps saved-city province plates at or above the 11px-equivalent floor', () => {
    expectReadableFunctionalMicrotype('src/components/CityTabs.css', '.city-tabs__plate');
  });

  it('keeps Daily Plan local-day boundaries at or above the 11px-equivalent floor', () => {
    expectReadableFunctionalMicrotype('src/components/hava81/DailyPlanPanel.css', '.daily-plan__slot-day');
  });

  it('keeps modeled context provenance and guidance at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/ContextSignalsPanel.css', 'utf8');
    expect(remFontSize(cssRule(css, '.context-signals__source'))).toBeGreaterThanOrEqual(0.8125);
    expect(remFontSize(cssRule(css, '.context-signals__note'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps modeled context units at or above the 11px-equivalent floor', () => {
    expectReadableFunctionalMicrotype(
      'src/components/hava81/ContextSignalsPanel.css',
      '.context-signal > strong small'
    );
  });

  it('keeps route safety disclaimer at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/RouteWeatherPanel.css', 'utf8');
    expect(remFontSize(cssRule(css, '.route-weather__disclaimer'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps map data attribution at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/WeatherMap.css', 'utf8');
    expect(remFontSize(cssRule(css, '.weather-map__attribution'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps forecast source attribution at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/ForecastAtlas.css', 'utf8');
    expect(remFontSize(cssRule(css, '.hava81-forecast-atlas__source'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps Activity Planner score qualifiers at or above the 11px-equivalent floor', () => {
    expectReadableFunctionalMicrotype(
      'src/components/hava81/ActivityPlanner.css',
      '.activity-card__score small'
    );
  });
});
