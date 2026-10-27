import { afterEach, describe, expect, it } from 'vitest';
import app from '../../styles/App.css?inline';
import offscreen from '../../styles/offscreen-panels.css?inline';
import settingsPanel from '../../components/SettingsPanel.css?inline';
import cityTabs from '../../components/CityTabs.css?inline';
import bottomNav from '../../components/hava81/AtlasBottomNav.css?inline';
import alerts from '../../components/hava81/DecisionAlertsPanel.css?inline';
import activity from '../../components/hava81/ActivityPlanner.css?inline';
import dailyPlan from '../../components/hava81/DailyPlanPanel.css?inline';
import environment from '../../components/hava81/EnvironmentRail.css?inline';
import route from '../../components/hava81/RouteWeatherPanel.css?inline';
import forecast from '../../components/hava81/ForecastAtlas.css?inline';
import compare from '../../components/hava81/ComparePanel.css?inline';
import decisionField from '../../components/hava81/WeatherDecisionField.css?inline';
import {
  DESKTOP,
  MOBILE,
  REDUCED_MOTION,
  computed,
  contrast,
  el,
  markup,
  mountStyles,
  unmountStyles,
} from '../helpers/styles';

/**
 * Faz 3.4: visual contracts that used to be regex checks on stylesheet text, now asserted on
 * the computed style of real markup (see helpers/styles.ts for the jsdom cascade emulation).
 */
afterEach(() => {
  unmountStyles();
  document.body.innerHTML = '';
});

const colors = (value: string) => value.match(/#[0-9a-f]{3,6}\b|rgba?\([^)]*\)/gi) ?? [];

describe('hourly rhythm labels meet WCAG AA on tinted hour columns', () => {
  const html = (mode: 'light' | 'dark') => `
    <div class="app" data-color-mode="${mode}">
      <section class="hava81-forecast-atlas">
        <div class="hava81-forecast-atlas__rhythm">
          <ol class="hava81-forecast-atlas__hours">
            <li class="hava81-forecast-atlas__hour is-current"><time>
              <span class="hava81-forecast-atlas__hour-now">Now</span><span>9 PM</span>
            </time><span class="hava81-forecast-atlas__hour-pop" role="group"><span>3%</span></span></li>
            <li class="hava81-forecast-atlas__hour is-day-boundary"><time>
              <span class="hava81-forecast-atlas__hour-day">Tomorrow</span><span>12 AM</span>
            </time></li>
          </ol>
        </div>
      </section>
    </div>`;

  it.each(['light', 'dark'] as const)('%s labels stay at 4.5:1 or better', mode => {
    mountStyles([app, forecast]);
    markup(html(mode));

    const appElement = el('.app');
    const timeLabel = el('.hava81-forecast-atlas__hour time > span:not(.hava81-forecast-atlas__hour-now):not(.hava81-forecast-atlas__hour-day)');
    const nowLabel = el('.hava81-forecast-atlas__hour-now');
    const dayLabel = el('.hava81-forecast-atlas__hour-day');
    const precipitationLabel = el('.hava81-forecast-atlas__hour-pop');
    const timeColor = computed(timeLabel, 'color');
    const accentColor = computed(nowLabel, 'color');
    const dayAccentColor = computed(dayLabel, 'color');
    const precipitationColor = computed(precipitationLabel, 'color');
    const backgrounds = mode === 'light'
      ? ['#dde4f2', '#eff0f4']
      : ['#102733', '#173342'];

    expect(timeColor).toBe(computed(appElement, '--color-atlas-ink'));
    expect(accentColor).toBe(computed(appElement, '--color-aegean-deep'));
    expect(dayAccentColor).toBe(accentColor);
    for (const background of backgrounds) {
      expect(contrast(timeColor, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accentColor, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(precipitationColor, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('focus ring token (Faz 0.6)', () => {
  const html = (mode: 'light' | 'dark') =>
    `<div class="app" data-color-mode="${mode}"><button type="button">Ara</button></div>`;

  it('draws the token ring around every focus-visible control', () => {
    mountStyles([app], { force: [':focus-visible'] });
    markup(html('light'));
    const outline = computed(el('button'), 'outline');
    expect(outline).toBe(
      `${computed(el('.app'), '--focus-ring-width')} solid ${computed(el('.app'), '--focus-ring-color')}`
    );
    expect(computed(el('button'), 'box-shadow')).toContain(
      computed(el('.app'), '--focus-ring-halo')
    );
  });

  it('does not draw the ring without keyboard focus', () => {
    mountStyles([app]);
    markup(html('light'));
    expect(computed(el('button'), 'outline')).not.toContain('solid');
  });

  it('keeps ring + halo at >= 3:1 on light cards, the navy header and dark surfaces', () => {
    mountStyles([app]);
    markup(html('light'));
    const lightRing = computed(el('.app'), '--focus-ring-color');
    const lightHalo = computed(el('.app'), '--focus-ring-halo');
    expect(contrast(lightRing, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrast(lightHalo, '#102a50')).toBeGreaterThanOrEqual(3);

    markup(html('dark'));
    const darkRing = computed(el('.app'), '--focus-ring-color');
    expect(darkRing).not.toBe(lightRing);
    expect(contrast(darkRing, '#0b1a2e')).toBeGreaterThanOrEqual(3);
    expect(contrast(darkRing, '#102a50')).toBeGreaterThanOrEqual(3);
  });
});

describe('favorite city rail on the navy header (Faz 0.3)', () => {
  const html = (mode: 'light' | 'dark') => `<div class="app" data-color-mode="${mode}">
    <header class="atlas-header"><div class="atlas-city-rail"><div class="city-tabs">
    <div class="city-tabs__scroll"><button class="city-tabs__item">Ankara</button>
    <button class="city-tabs__item active">İstanbul</button></div></div></div></header></div>`;

  it.each(['light', 'dark'] as const)(
    'uses light on-dark tab text that meets WCAG AA on the header gradient (%s)',
    mode => {
      mountStyles([app, cityTabs], { viewport: DESKTOP });
      markup(html(mode));
      const tab = computed(el('.city-tabs__item:not(.active)'), 'color');
      const active = computed(el('.city-tabs__item.active'), 'color');
      expect(tab).toBe('#f2f9ff');
      expect(contrast(active, '#ffffff')).toBe(1);

      for (const stop of ['#102a50', '#123d67', '#14677e']) {
        expect(contrast(tab, stop)).toBeGreaterThanOrEqual(4.5);
      }
    }
  );
});

describe('decision alerts button (Faz 0.4)', () => {
  const html = `<div class="app"><section class="decision-alerts">
    <button type="button" class="enabled">Bildirim aç</button>
    <button type="button" class="blocked" disabled>Bildirim engelli</button></section></div>`;

  it('sets an explicit premium-blue text colour so it never renders white on white', () => {
    mountStyles([alerts]);
    markup(html);
    const color = computed(el('.enabled'), 'color');
    expect(color).toBe(computed(el('.app'), '--premium-blue'));
    expect(contrast(color, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('shows the blocked/disabled state without relying on opacity alone', () => {
    mountStyles([alerts]);
    markup(html);
    const blocked = el('.blocked');
    expect(computed(blocked, 'color')).toBe(computed(el('.app'), '--color-atlas-muted'));
    expect(computed(blocked, 'border-style')).toBe('dashed');
    expect(computed(blocked, 'opacity')).toBe('1');
  });
});

describe('mobile bottom navigation (blue premium dock)', () => {
  const html = `<div class="app" data-has-bottom-nav="true"><nav class="atlas-bottom-nav">
    <button type="button" class="atlas-bottom-nav__button atlas-bottom-nav__button--active" aria-current="page">
      <span class="atlas-bottom-nav__icon"></span><span class="atlas-bottom-nav__label">Bugün</span></button>
    <button type="button" class="atlas-bottom-nav__button"><span class="atlas-bottom-nav__label">Planla</span></button>
    <button type="button" class="atlas-bottom-nav__button map" disabled><span class="atlas-bottom-nav__label">Harita</span></button>
    </nav></div>`;

  it('sits on the navy gradient dock with a light, readable active pill', () => {
    mountStyles([bottomNav], { viewport: MOBILE });
    markup(html);
    expect(computed(el('.atlas-bottom-nav'), 'background')).toContain('linear-gradient');
    const active = el('.atlas-bottom-nav__button--active');
    const pill = colors(computed(active, 'background'));
    expect(pill.length).toBeGreaterThan(0);
    for (const stop of pill) {
      expect(contrast(computed(active, 'color'), stop)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps inactive labels readable on every stop of the dock gradient', () => {
    mountStyles([bottomNav], { viewport: MOBILE });
    markup(html);
    const inactive = computed(
      el('.atlas-bottom-nav__button:not(.atlas-bottom-nav__button--active)'),
      'color'
    );
    const background = computed(el('.atlas-bottom-nav'), 'background');
    const dock = colors(background.slice(background.indexOf('linear-gradient')));
    expect(dock.length).toBeGreaterThan(0);
    for (const stop of dock) expect(contrast(inactive, stop)).toBeGreaterThanOrEqual(4.5);
  });

  it('dims an unusable destination', () => {
    mountStyles([bottomNav], { viewport: MOBILE });
    markup(html);
    expect(Number(computed(el('.map'), 'opacity'))).toBeLessThan(1);
    expect(computed(el('.atlas-bottom-nav__button--active'), 'opacity')).not.toBe(
      computed(el('.map'), 'opacity')
    );
  });
});

describe('reduced motion (decision controls and route disclosure)', () => {
  const cases = [
    {
      name: 'Activity Planner chip hover',
      sheets: [activity],
      html: '<div class="app"><div class="activity-planner__chips"><button class="target">Koşu</button></div></div>',
      property: 'transform',
      force: [':hover'],
    },
    {
      name: 'Daily Plan share press',
      sheets: [dailyPlan],
      html: '<div class="app"><section class="daily-plan"><button class="daily-plan__share target">Paylaş</button></section></div>',
      property: 'transform',
      force: [':active'],
    },
    {
      name: 'Environment Rail press',
      sheets: [environment],
      html: '<div class="app"><section class="environment-rail"><button class="environment-rail__module environment-rail__module--action target">UV</button></section></div>',
      property: 'transform',
      force: [':active'],
    },
    {
      name: 'bottom navigation press',
      sheets: [bottomNav],
      html: '<div class="app"><nav class="atlas-bottom-nav"><button class="atlas-bottom-nav__button"><span class="atlas-bottom-nav__icon target"></span></button></nav></div>',
      property: 'transform',
      force: [':active'],
    },
    {
      name: 'route disclosure chevron',
      sheets: [route],
      html: '<div class="app"><details class="route-weather"><summary><span></span><span class="route-weather__chevron target"></span></summary></details></div>',
      property: 'transition',
      force: [],
    },
  ];

  it.each(cases)('keeps $name stationary when reduced motion is requested', c => {
    mountStyles(c.sheets, { viewport: MOBILE, features: REDUCED_MOTION, force: c.force });
    markup(c.html);
    expect(computed(el('.target'), c.property)).toBe('none');
  });

  it.each(cases)('animates $name when motion is allowed', c => {
    mountStyles(c.sheets, { viewport: MOBILE, force: c.force });
    markup(c.html);
    expect(computed(el('.target'), c.property)).not.toMatch(/^(none|)$/);
  });
});

describe('mobile horizontal rails (Faz 0.5)', () => {
  it('wraps activity choices instead of a horizontal chip rail', () => {
    mountStyles([activity], { viewport: MOBILE });
    markup(
      '<div class="app"><div class="activity-planner__chips"><button>Koşu</button><button>Piknik</button></div></div>'
    );
    const chips = el('.activity-planner__chips');
    expect(computed(chips, 'flex-wrap')).toBe('wrap');
    expect(computed(chips, 'overflow')).toBe('visible');
    expect(computed(el('.activity-planner__chips button'), 'max-width')).toBe('100%');
  });

  it('hides native scrollbars on mobile horizontal rails', () => {
    mountStyles([forecast, cityTabs, dailyPlan, activity], { viewport: MOBILE });
    markup(`<div class="app">
      <div class="hava81-forecast-atlas__range"></div>
      <div class="hava81-forecast-atlas__hourly-viewport"></div>
      <div class="city-tabs__scroll"></div>
      <div class="daily-plan__slots"></div></div>`);
    for (const rail of [
      '.hava81-forecast-atlas__range',
      '.hava81-forecast-atlas__hourly-viewport',
      '.city-tabs__scroll',
      '.daily-plan__slots',
    ]) {
      expect(computed(el(rail), 'scrollbar-width'), rail).toBe('none');
    }
  });

  it('wraps the range picker instead of overflowing it', () => {
    mountStyles([forecast], { viewport: MOBILE });
    markup('<div class="app"><div class="hava81-forecast-atlas__range"></div></div>');
    const range = el('.hava81-forecast-atlas__range');
    expect(computed(range, 'flex-wrap')).toBe('wrap');
    expect(computed(range, 'overflow-x')).toBe('visible');
  });

  it('keeps forecast interval targets at least 44px wide in the narrow-phone grid', () => {
    mountStyles([forecast], { viewport: { width: 320, height: 640 } });
    markup('<div class="app"><section class="hava81-forecast-atlas"><div class="hava81-forecast-atlas__rhythm"><div class="hava81-forecast-atlas__range"><button class="hava81-forecast-atlas__range-button">1sa</button></div></div></section></div>');
    expect(computed(el('.hava81-forecast-atlas__range'), 'width')).toBe('100%');
    expect(computed(el('.hava81-forecast-atlas__range-button'), 'min-width')).toBe('44px');
  });

});

describe('offscreen decision panel containment', () => {
  it('keeps commute and route tools mounted while letting offscreen rendering be skipped', () => {
    mountStyles([offscreen]);
    markup(
      '<div class="atlas-dashboard"><section class="commute-plan"></section><details class="route-weather"></details></div>'
    );
    expect(computed(el('.commute-plan'), 'content-visibility')).toBe('auto');
    expect(computed(el('.commute-plan'), 'contain-intrinsic-size')).toBe('auto 28rem');
    expect(computed(el('.route-weather'), 'content-visibility')).toBe('auto');
    expect(computed(el('.route-weather'), 'contain-intrinsic-size')).toBe('auto 7rem');
  });
});

describe('200% text overflow guards', () => {
  it.each([
    {
      name: 'the next-change sentence ("Önümüzdeki" at 320px)',
      sheets: [decisionField],
      html: '<div class="app"><section class="hava81-decision-field"><p class="hava81-decision-field__next-change target">Önümüzdeki saatlerde</p></section></div>',
    },
    {
      name: 'the 1sa…12sa interval buttons (320–360px)',
      sheets: [forecast],
      html: '<div class="app"><section class="hava81-forecast-atlas"><div class="hava81-forecast-atlas__rhythm"><div class="hava81-forecast-atlas__range"><button class="hava81-forecast-atlas__range-button target">12sa</button></div></div></section></div>',
    },
    {
      name: 'the Compare kicker ("FAVORITE CITIES" at 768px)',
      sheets: [app, compare],
      html: '<div class="app"><section class="hava81-compare"><header class="hava81-compare__header"><span class="atlas-kicker target">Favorite cities</span></header></section></div>',
    },
  ])('lets $name break inside long words instead of overflowing', ({ sheets, html }) => {
    for (const viewport of [
      { width: 320, height: 640 },
      { width: 360, height: 640 },
      { width: 768, height: 1024 },
    ]) {
      mountStyles(sheets, { viewport });
      markup(html);
      const target = el('.target');
      expect(computed(target, 'overflow-wrap')).toBe('anywhere');
      expect(computed(target, 'white-space')).not.toBe('nowrap');
    }
  });
});

describe('settings version metadata contrast', () => {
  const html = (mode: 'light' | 'dark') =>
    '<div class="app" data-color-mode="' + mode + '">' +
      '<div class="settings-panel"><div class="settings-panel__footer">' +
        '<p class="settings-panel__version">v2.1.0</p>' +
      '</div></div></div>';

  it.each(['light', 'dark'] as const)('%s version text meets WCAG AA', mode => {
    mountStyles([app, settingsPanel]);
    markup(html(mode));

    const color = computed(el('.settings-panel__version'), 'color');
    const background = mode === 'light' ? '#f3f7fd' : '#0c2131';
    expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5);
  });
});
