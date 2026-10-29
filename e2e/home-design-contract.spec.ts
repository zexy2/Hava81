/**
 * Design contract for the lower Today surfaces: weather warning, decision summary,
 * environment instruments and footer.
 *
 * FROZEN: written before the redesign and not edited afterwards. The implementation
 * has to satisfy these checks as written; if a check is wrong, raise it with the owner
 * instead of changing it.
 */
import type { Locator, Page } from '@playwright/test';
import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import { ensureForecastAtlasLoaded } from './helpers/forecast';
import { expectNoHorizontalScroll, expectNoOverlap, setWidth } from './helpers/layout';
import { fixtures, overrideDaily, seedSettings } from './helpers/weather-fixtures';

const { localDate } = fixtures;

const STORM_DAILY = [
  { date: localDate(), tempMin: 19, tempMax: 27, icon: '02d', description: 'parçalı bulutlu', pop: 20 },
  {
    date: localDate(1),
    tempMin: 15,
    tempMax: 18,
    icon: '11d',
    description: 'gök gürültülü fırtına',
    pop: 85,
    precipitationMm: 27.6,
  },
  { date: localDate(2), tempMin: 14, tempMax: 17, icon: '10d', description: 'yağmur', pop: 40, precipitationMm: 3 },
];

const LOWER_REGIONS = [
  '[data-testid="severe-weather-banner"]',
  '[data-testid="decision-glance"]',
  '.environment-rail',
  '[data-testid="app-footer"]',
];

async function openToday(page: Page) {
  await overrideDaily(page, STORM_DAILY);
  await page.goto('/istanbul/');
  await ensureForecastAtlasLoaded(page);
  await expect(page.getByTestId('decision-glance')).toBeVisible();
  await expect(page.getByTestId('score-gauge')).toBeVisible();
  await page.locator('.environment-rail').scrollIntoViewIfNeeded();
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value, 'element has a layout box').not.toBeNull();
  return value!;
}

async function fontSize(locator: Locator) {
  return locator.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
}

async function axeFailures(page: Page, include: string[]) {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  return page.evaluate(async selectors => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            context: unknown,
            options: unknown
          ) => Promise<{
            violations: Array<{ id: string; nodes: Array<{ target: string[] }> }>;
          }>;
        };
      }
    ).axe;
    const present = selectors.filter(selector => document.querySelector(selector));
    const result = await axe.run(
      { include: present.map(selector => [selector]) },
      {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
        },
      }
    );
    return result.violations.flatMap(violation =>
      violation.nodes.map(node => `${violation.id} — ${node.target.join(', ')}`)
    );
  }, include);
}

test.describe('home design contract', () => {
  test('warning strip spans the page directly above the decision summary', DESKTOP, async ({ page }) => {
    await openToday(page);
    const banner = page.getByTestId('severe-weather-banner');
    const glance = page.getByTestId('decision-glance');
    await expect(banner).toBeVisible();
    const b = await box(banner);
    const g = await box(glance);
    expect(Math.abs(b.width - g.width), 'banner and summary share one width').toBeLessThanOrEqual(2);
    expect(Math.abs(b.x - g.x), 'banner and summary share one left edge').toBeLessThanOrEqual(2);
    const gap = g.y - (b.y + b.height);
    expect(gap, 'banner sits right above the summary').toBeGreaterThanOrEqual(0);
    expect(gap, 'banner sits right above the summary').toBeLessThanOrEqual(32);

    // Day, chance and amount are separate, scannable pieces rather than one sentence.
    await expect(banner.getByTestId('severe-weather-day')).toBeVisible();
    await expect(banner.locator('[data-metric="pop"]')).toContainText('85');
    await expect(banner.locator('[data-metric="mm"]')).toContainText('28');
    // A real icon, not a text glyph.
    await expect(banner.locator('svg').first()).toBeVisible();
    expect(await banner.textContent()).not.toMatch(/[⚠☂☼◷]/);
  });

  test('decision summary leads with one large headline and a real score gauge', DESKTOP, async ({ page }) => {
    await openToday(page);
    const glance = page.getByTestId('decision-glance');
    const headline = glance.locator('.decision-glance__message');
    expect(await fontSize(headline), 'headline is display size on desktop').toBeGreaterThanOrEqual(40);

    const headlineLines = await headline.evaluate(element => {
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
      return Math.round(element.getBoundingClientRect().height / lineHeight);
    });
    expect(headlineLines, 'headline stays short').toBeLessThanOrEqual(3);

    const gauge = glance.getByTestId('score-gauge');
    const svg = gauge.locator('svg[role="img"]');
    await expect(svg).toBeVisible();
    await expect(svg).toHaveAttribute('aria-label', /\d{1,3}/);
    expect(await gauge.locator('[data-gauge-tick]').count(), 'gauge has a scale').toBeGreaterThanOrEqual(10);
    await expect(gauge.locator('[data-gauge-progress]')).toHaveCount(1);
    const numeric = await gauge
      .locator('[data-gauge-value]')
      .evaluate(element => getComputedStyle(element).fontVariantNumeric);
    expect(numeric).toContain('tabular-nums');

    // Facts read as one structured list, without text-glyph icons.
    const facts = glance.getByTestId('decision-timeline');
    await expect(facts).toHaveAttribute('role', 'list');
    const items = facts.locator('[role="listitem"]');
    expect(await items.count()).toBeGreaterThanOrEqual(3);
    for (let index = 0; index < (await items.count()); index += 1) {
      await expect(items.nth(index).locator('svg').first()).toBeVisible();
    }
    expect(await glance.textContent()).not.toMatch(/[⚠☂☼◷]/);

    // At most one letter-spaced uppercase kicker inside the card.
    const kickers = await glance.evaluate(root =>
      Array.from(root.querySelectorAll<HTMLElement>('*')).filter(element => {
        const style = getComputedStyle(element);
        return (
          style.textTransform === 'uppercase' &&
          parseFloat(style.letterSpacing) > 0.5 &&
          (element.textContent ?? '').trim().length > 0 &&
          element.offsetParent !== null
        );
      }).length
    );
    expect(kickers, 'one kicker at most').toBeLessThanOrEqual(1);
    await expectNoOverlap(headline, gauge, 'headline vs score gauge');
  });

  test('environment instruments draw the live data', DESKTOP, async ({ page }) => {
    await openToday(page);
    const rail = page.locator('.environment-rail');

    // Daylight: the sun marker sits at the elapsed share of today's daylight (fixture ≈ 50%).
    const daylight = rail.getByTestId('instrument-daylight');
    const sun = daylight.locator('[data-sun-position]');
    await expect(sun).toHaveCount(1);
    const position = Number(await sun.getAttribute('data-sun-position'));
    expect(position).toBeGreaterThan(0.45);
    expect(position).toBeLessThan(0.55);
    await expect(daylight.locator('svg').first()).toBeVisible();

    // Wind: the arrow is rotated to the reported direction (fixture 180°).
    const wind = rail.getByTestId('instrument-wind');
    const arrow = wind.locator('[data-wind-arrow]');
    await expect(arrow).toHaveCount(1);
    expect(Number(await arrow.getAttribute('data-rotation'))).toBe(180);

    // Air quality: a five-step scale with exactly the reported step active (fixture 2).
    const aqi = rail.getByTestId('instrument-aqi');
    await expect(aqi.locator('[data-aqi-segment]')).toHaveCount(5);
    await expect(aqi.locator('[data-aqi-segment][data-active="true"]')).toHaveCount(1);
    await expect(aqi.locator('[data-aqi-segment][data-active="true"]')).toHaveAttribute(
      'data-aqi-segment',
      '2'
    );

    // Map: a Turkey outline with the city dot placed by its coordinates (İstanbul ≈ 16% across).
    const map = rail.getByTestId('instrument-map');
    await expect(map).toHaveJSProperty('tagName', 'BUTTON');
    const dot = map.locator('[data-city-dot]');
    await expect(dot).toHaveCount(1);
    const across = Number(await dot.getAttribute('data-x'));
    expect(across).toBeGreaterThan(0.1);
    expect(across).toBeLessThan(0.22);
    const mapBox = await box(map);
    expect(mapBox.height).toBeGreaterThanOrEqual(44);

    // Four instruments line up as one row with equal heights and a large value each.
    const instruments = rail.locator('[data-testid^="instrument-"]');
    await expect(instruments).toHaveCount(4);
    const boxes = await Promise.all([0, 1, 2, 3].map(index => box(instruments.nth(index))));
    const tops = boxes.map(item => Math.round(item.y));
    const heights = boxes.map(item => Math.round(item.height));
    expect(Math.max(...tops) - Math.min(...tops), 'one row').toBeLessThanOrEqual(2);
    expect(Math.max(...heights) - Math.min(...heights), 'equal heights').toBeLessThanOrEqual(2);
    for (let index = 0; index < 3; index += 1) {
      const value = instruments.nth(index).locator('.environment-rail__value');
      expect(await fontSize(value), `instrument ${index} value size`).toBeGreaterThanOrEqual(28);
    }
  });

  test('footer is one calm row with shortcut hints', DESKTOP, async ({ page }) => {
    await openToday(page);
    const footer = page.getByTestId('app-footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    expect((await box(footer)).height).toBeLessThanOrEqual(72);
    expect(await footer.locator('kbd').count()).toBeGreaterThanOrEqual(2);
  });

  test('lower surfaces pass axe in light and dark themes', DESKTOP, async ({ page }) => {
    for (const themeMode of ['light', 'dark'] as const) {
      await seedSettings(page, { themeMode });
      await openToday(page);
      expect(await axeFailures(page, LOWER_REGIONS), `${themeMode} theme`).toEqual([]);
    }
  });

  test('reduced motion stops every animation in the lower surfaces', DESKTOP, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openToday(page);
    await page.waitForTimeout(600);
    const running = await page.evaluate(selectors => {
      return selectors.flatMap(selector => {
        const root = document.querySelector(selector);
        if (!root) return [];
        return [root, ...Array.from(root.querySelectorAll('*'))].flatMap(element =>
          element
            .getAnimations()
            .filter(animation => animation.playState === 'running')
            .map(() => selector)
        );
      });
    }, LOWER_REGIONS);
    expect(running).toEqual([]);
  });

  test('phone layout keeps the instruments readable without sideways scroll', MOBILE, async ({ page }) => {
    await openToday(page);
    const instruments = page.locator('.environment-rail [data-testid^="instrument-"]');
    await expect(instruments).toHaveCount(4);
    const first = await box(instruments.nth(0));
    const second = await box(instruments.nth(1));
    expect(Math.abs(first.y - second.y), 'two instruments per row on phones').toBeLessThanOrEqual(2);
    const headline = page.getByTestId('decision-glance').locator('.decision-glance__message');
    expect(await fontSize(headline)).toBeGreaterThanOrEqual(26);
    await expectNoHorizontalScroll(page, '390px');
    await setWidth(page, 320, 844);
    await expectNoHorizontalScroll(page, '320px');
  });
});
