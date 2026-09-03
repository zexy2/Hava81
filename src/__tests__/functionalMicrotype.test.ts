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
  it('keeps Settings control-group headings at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/SettingsPanel.css', 'utf8');
    expect(remFontSize(cssRule(css, '.settings-section__title'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps top navigation state labels at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/styles/App.css', 'utf8');
    expect(remFontSize(cssRule(css, '.atlas-compare-button span'))).toBeGreaterThanOrEqual(0.8125);
    expect(remFontSize(cssRule(css, '.atlas-settings-button__language'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps saved-city province plates at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/CityTabs.css', 'utf8');
    expect(remFontSize(cssRule(css, '.city-tabs__plate'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps Daily Plan decision labels at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/DailyPlanPanel.css', 'utf8');
    expect(
      remFontSize(cssRule(css, '.daily-plan__decision > span,\n.daily-plan__quick span'))
    ).toBeGreaterThanOrEqual(0.8125);
    expect(
      remFontSize(cssRule(css, '.daily-plan__explain-head span,\n.daily-plan__explain-head small'))
    ).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps Daily Plan score band context at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/DailyPlanPanel.css', 'utf8');
    expect(remFontSize(cssRule(css, '.daily-plan__score small'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps Daily Plan local-day boundaries at or above the 11px-equivalent floor', () => {
    expectReadableFunctionalMicrotype('src/components/hava81/DailyPlanPanel.css', '.daily-plan__slot-day');
  });

  it('keeps first-view weather provenance and freshness at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/WeatherDecisionField.css', 'utf8');
    expect(remFontSize(cssRule(css, '.hava81-decision-field__atlas-meta'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps first-view change and metric labels at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/WeatherDecisionField.css', 'utf8');
    expect(remFontSize(cssRule(css, '.hava81-decision-field__change-title'))).toBeGreaterThanOrEqual(0.8125);
    expect(remFontSize(cssRule(css, '.hava81-decision-field__metric dt'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps comparison decision qualifiers at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/ComparePanel.css', 'utf8');
    expect(remFontSize(cssRule(css, '.hava81-compare__winner span,\n.hava81-compare__winner small'))).toBeGreaterThanOrEqual(0.8125);
    expect(remFontSize(cssRule(css, '.hava81-compare__score-wrap small'))).toBeGreaterThanOrEqual(0.8125);
    expect(remFontSize(cssRule(css, '.hava81-compare__score span'))).toBeGreaterThanOrEqual(0.8125);
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

  it('keeps route score qualifiers at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/RouteWeatherPanel.css', 'utf8');
    expect(remFontSize(cssRule(css, '.route-weather__score small'))).toBeGreaterThanOrEqual(0.8125);
    expect(remFontSize(cssRule(css, '.route-weather__score strong span'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps route input labels at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/RouteWeatherPanel.css', 'utf8');
    expect(remFontSize(cssRule(css, '.route-weather__form label'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps route segment timing and condition context at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/RouteWeatherPanel.css', 'utf8');
    expect(remFontSize(cssRule(css, '.route-segment time,\n.route-segment small'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps route safety disclaimer at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/RouteWeatherPanel.css', 'utf8');
    expect(remFontSize(cssRule(css, '.route-weather__disclaimer'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps map data attribution at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/WeatherMap.css', 'utf8');
    expect(remFontSize(cssRule(css, '.weather-map__attribution'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps map temperature legend labels at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/WeatherMap.css', 'utf8');
    expect(remFontSize(cssRule(css, '.weather-map__legend-item'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps map popup province plates at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/WeatherMap.css', 'utf8');
    expect(remFontSize(cssRule(css, '.weather-map__popup-plate'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps Context Signals measurement units at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/ContextSignalsPanel.css', 'utf8');
    expect(remFontSize(cssRule(css, '.context-signal > strong small'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps forecast source attribution at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/ForecastAtlas.css', 'utf8');
    expect(remFontSize(cssRule(css, '.hava81-forecast-atlas__source'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps Forecast Atlas hourly day and current-time labels at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/ForecastAtlas.css', 'utf8');
    expect(remFontSize(cssRule(css, '.hava81-forecast-atlas__hour-day'))).toBeGreaterThanOrEqual(0.8125);
    expect(remFontSize(cssRule(css, '.hava81-forecast-atlas__hour-now'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps Forecast Atlas horizon controls at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/ForecastAtlas.css', 'utf8');
    expect(remFontSize(cssRule(css, '.hava81-forecast-atlas__range-label'))).toBeGreaterThanOrEqual(0.8125);
    expect(remFontSize(cssRule(css, '.hava81-forecast-atlas__range-button'))).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps Forecast Atlas first-precipitation annotation at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/ForecastAtlas.css', 'utf8');
    expect(
      remFontSize(cssRule(css, '.hava81-forecast-atlas__precipitation-marker text'))
    ).toBeGreaterThanOrEqual(0.8125);
  });

  it('keeps Activity Planner score qualifiers at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/ActivityPlanner.css', 'utf8');
    expect(remFontSize(cssRule(css, '.activity-card__score small'))).toBeGreaterThanOrEqual(0.8125);
    expect(remFontSize(cssRule(css, '.activity-card header strong span'))).toBeGreaterThanOrEqual(0.8125);
  });
  it('keeps Environment Rail evidence labels at or above the 13px-equivalent floor', () => {
    const css = readFileSync('src/components/hava81/EnvironmentRail.css', 'utf8');
    expect(remFontSize(cssRule(css, '.environment-rail__label'))).toBeGreaterThanOrEqual(0.8125);
  });
});
