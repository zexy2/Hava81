import { afterEach, describe, expect, it } from 'vitest';
import app from '../../styles/App.css?inline';
import settings from '../../components/SettingsPanel.css?inline';
import cityTabs from '../../components/CityTabs.css?inline';
import weatherMap from '../../components/WeatherMap.css?inline';
import dailyPlan from '../../components/hava81/DailyPlanPanel.css?inline';
import decisionField from '../../components/hava81/WeatherDecisionField.css?inline';
import compare from '../../components/hava81/ComparePanel.css?inline';
import contextSignals from '../../components/hava81/ContextSignalsPanel.css?inline';
import route from '../../components/hava81/RouteWeatherPanel.css?inline';
import forecast from '../../components/hava81/ForecastAtlas.css?inline';
import activity from '../../components/hava81/ActivityPlanner.css?inline';
import environment from '../../components/hava81/EnvironmentRail.css?inline';
import {
  DESKTOP,
  FUNCTIONAL_COPY_FLOOR_PX,
  MOBILE,
  NARROW,
  TABLET,
  computed,
  el,
  fontSizePx,
  markup,
  mountStyles,
  unmountStyles,
} from '../helpers/styles';

/**
 * Faz 3.4: the functional-copy floor (13px = 0.8125rem) is asserted on the browser-computed
 * font size of real markup, so `.app …` overrides and later rules count, not just the first
 * declaration in the source file.
 */
interface Case {
  name: string;
  sheets: string[];
  html: string;
  targets: string[];
}

const cases: Case[] = [
  {
    name: 'Settings control-group headings, language flags and version metadata',
    sheets: [settings],
    html: `<div class="app"><div class="settings-panel">
      <h3 class="settings-section__title">Tema</h3>
      <span class="settings-option"><span class="settings-option__flag">TR</span></span>
      <p class="settings-panel__version">v2.1.0</p></div></div>`,
    targets: ['.settings-section__title', '.settings-option__flag', '.settings-panel__version'],
  },
  {
    name: 'product kickers, header state labels and footer guidance',
    sheets: [app],
    html: `<div class="app"><header class="atlas-header"><div class="atlas-header__actions">
      <button class="atlas-compare-button">Karşılaştır<span>2</span></button>
      <button class="atlas-settings-button"><span class="atlas-settings-button__language">TR</span></button>
      </div></header><span class="atlas-kicker">Bugün</span>
      <footer class="atlas-footer"><span class="atlas-footer__shortcuts"><kbd>Ctrl+K</kbd></span></footer></div>`,
    targets: [
      '.atlas-kicker',
      '.atlas-compare-button span',
      '.atlas-settings-button__language',
      '.atlas-footer',
    ],
  },
  {
    name: 'saved-city province plates',
    sheets: [app, cityTabs],
    html: `<div class="app"><div class="atlas-city-rail"><div class="city-tabs"><div class="city-tabs__scroll">
      <button class="city-tabs__item"><span class="city-tabs__plate">34</span>İstanbul</button>
      </div></div></div></div>`,
    targets: ['.city-tabs__plate'],
  },
  {
    name: 'Daily Plan decision labels, score band, slots and day boundaries',
    sheets: [dailyPlan],
    html: `<div class="app"><section class="daily-plan">
      <div class="daily-plan__decision"><span>Karar</span></div>
      <div class="daily-plan__quick"><span>Hızlı</span></div>
      <div class="daily-plan__explain-head"><span>Neden</span><small>model</small></div>
      <div class="daily-plan__score"><small>Rahat</small></div>
      <div class="daily-plan__slots"><div class="daily-plan__slot"><time>
      <span class="daily-plan__slot-day">Yarın</span><span>09:00</span></time><strong>80</strong>
      <small>24°</small></div></div></section></div>`,
    targets: [
      '.daily-plan__decision > span',
      '.daily-plan__quick span',
      '.daily-plan__explain-head span',
      '.daily-plan__explain-head small',
      '.daily-plan__score small',
      '.daily-plan__slot time',
      '.daily-plan__slot small',
      '.daily-plan__slot-day',
    ],
  },
  {
    name: 'first-view plate, provenance, change and metric labels',
    sheets: [decisionField],
    html: `<div class="app"><section class="hava81-decision-field">
      <span class="hava81-decision-field__plate">34</span>
      <p class="hava81-decision-field__atlas-meta">OpenWeather · 09:00</p>
      <span class="hava81-decision-field__change-title">Önümüzdeki değişim</span>
      <dl><div class="hava81-decision-field__metric"><dt>Rüzgâr</dt><dd>4 m/s</dd></div></dl>
      </section></div>`,
    targets: [
      '.hava81-decision-field__plate',
      '.hava81-decision-field__atlas-meta',
      '.hava81-decision-field__change-title',
      '.hava81-decision-field__metric dt',
    ],
  },
  {
    name: 'comparison decision qualifiers',
    sheets: [compare],
    html: `<div class="app"><section class="hava81-compare">
      <div class="hava81-compare__winner"><span>En iyi</span><small>hava açısından</small></div>
      <div class="hava81-compare__score-wrap"><small>/100</small>
      <strong class="hava81-compare__score">82<span>/100</span></strong></div></section></div>`,
    targets: [
      '.hava81-compare__winner span',
      '.hava81-compare__winner small',
      '.hava81-compare__score-wrap small',
      '.hava81-compare__score span',
    ],
  },
  {
    name: 'modeled context labels, units, provenance and guidance',
    sheets: [contextSignals],
    html: `<div class="app"><section class="context-signals">
      <div class="context-signal"><span>UV</span><strong>6<small>indeks</small></strong></div>
      <p class="context-signals__source">Open-Meteo</p><p class="context-signals__note">model</p>
      </section></div>`,
    targets: [
      '.context-signal > span',
      '.context-signal > strong small',
      '.context-signals__source',
      '.context-signals__note',
    ],
  },
  {
    name: 'route score, inputs, hint, segments and disclaimer',
    sheets: [route],
    html: `<div class="app"><section class="route-weather">
      <form class="route-weather__form"><label>Nereden</label></form>
      <p class="route-weather__hint">ipucu</p>
      <div class="route-weather__score"><small>Rota</small><strong>70<span>/100</span></strong></div>
      <ol><li class="route-segment"><time>10:00</time><small>yağmur</small></li></ol>
      <p class="route-weather__disclaimer">uyarı</p></section></div>`,
    targets: [
      '.route-weather__score small',
      '.route-weather__score strong span',
      '.route-weather__form label',
      '.route-weather__hint',
      '.route-segment time',
      '.route-segment small',
      '.route-weather__disclaimer',
    ],
  },
  {
    name: 'map attribution, legend, popup plate and province markers',
    sheets: [weatherMap],
    html: `<div class="app"><section class="weather-map">
      <p class="weather-map__attribution">© OSM</p>
      <ul><li class="weather-map__legend-item">0°</li></ul>
      <span class="weather-map__popup-plate">34</span>
      <div class="weather-map__plate-marker"><span>34</span></div></section></div>`,
    targets: [
      '.weather-map__attribution',
      '.weather-map__legend-item',
      '.weather-map__popup-plate',
      '.weather-map__plate-marker span',
    ],
  },
  {
    name: 'Forecast Atlas evidence, headings, horizon controls and annotations',
    sheets: [forecast],
    html: `<div class="app"><section class="hava81-forecast-atlas">
      <div class="hava81-forecast-atlas__rhythm">
        <h3 class="hava81-forecast-atlas__section-title">Saatlik</h3>
        <span class="hava81-forecast-atlas__range-label">Aralık</span>
        <div class="hava81-forecast-atlas__range"><button class="hava81-forecast-atlas__range-button">3sa</button></div>
        <span class="hava81-forecast-atlas__unit">°C</span>
        <svg><text class="hava81-forecast-atlas__axis-label">20°</text>
        <g class="hava81-forecast-atlas__precipitation-marker"><text>yağış</text></g></svg>
        <div class="hava81-forecast-atlas__hourly-viewport"><div class="hava81-forecast-atlas__hour">
          <span class="hava81-forecast-atlas__hour-day">Yarın</span>
          <span class="hava81-forecast-atlas__hour-now">Şimdi</span>
          <time>09:00</time><span class="hava81-forecast-atlas__hour-pop">%20</span></div></div>
        <p class="hava81-forecast-atlas__source">Open-Meteo</p>
      </div>
      <div class="hava81-forecast-atlas__days"><span class="hava81-forecast-atlas__day-pop">%10</span></div>
      </section></div>`,
    targets: [
      '.hava81-forecast-atlas__section-title',
      '.hava81-forecast-atlas__range-label',
      '.hava81-forecast-atlas__range-button',
      '.hava81-forecast-atlas__unit',
      '.hava81-forecast-atlas__axis-label',
      '.hava81-forecast-atlas__precipitation-marker text',
      '.hava81-forecast-atlas__hour-day',
      '.hava81-forecast-atlas__hour-now',
      '.hava81-forecast-atlas__hour time',
      '.hava81-forecast-atlas__hour-pop',
      '.hava81-forecast-atlas__source',
      '.hava81-forecast-atlas__day-pop',
    ],
  },
  {
    name: 'Activity Planner score qualifiers',
    sheets: [activity],
    html: `<div class="app"><section class="activity-planner"><article class="activity-card">
      <header><strong>78<span>/100</span></strong></header>
      <div class="activity-card__score"><small>uygun</small></div></article></section></div>`,
    targets: ['.activity-card__score small', '.activity-card header strong span'],
  },
  {
    name: 'Environment Rail evidence labels',
    sheets: [environment],
    html: `<div class="app"><section class="environment-rail"><div class="environment-rail__module">
      <span class="environment-rail__label">Gün doğumu</span></div></section></div>`,
    targets: ['.environment-rail__label'],
  },
];

afterEach(() => {
  unmountStyles();
  document.body.innerHTML = '';
});

describe('functional microtype (computed, Faz 3.4)', () => {
  for (const [label, viewport] of Object.entries({ NARROW, MOBILE, TABLET, DESKTOP })) {
    describe(label, () => {
      it.each(cases)('keeps $name at or above 13px', ({ sheets, html, targets }) => {
        mountStyles(sheets, { viewport });
        markup(html);
        for (const target of targets) {
          const size = fontSizePx(el(target));
          expect
            .soft(size, `${target} (${label})`)
            .toBeGreaterThanOrEqual(FUNCTIONAL_COPY_FLOOR_PX);
        }
      });
    });
  }

  it('measures real declarations: an unstyled element falls back to the 16px default', () => {
    mountStyles([]);
    markup('<span class="not-a-product-class">x</span>');
    expect(fontSizePx(el('.not-a-product-class'))).toBe(16);
  });

  it('sets keyboard-key labels in the footer at the 13px floor with a 1.4 line height', () => {
    mountStyles([app]);
    markup('<div class="app"><footer class="atlas-footer"><kbd>Ctrl+K</kbd></footer></div>');
    const key = el('kbd');
    expect(computed(key, 'font')).toMatch(/^500 0\.8125rem\/1\.4 /);
  });
});
