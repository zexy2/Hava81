/**
 * Design contract for the hourly rhythm and the 5-day forecast.
 *
 * FROZEN: written before the redesign and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it. Data is fixed per test; nothing
 * depends on the wall-clock time of day.
 */
import type { Locator, Page } from '@playwright/test';
import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import { ensureForecastAtlasLoaded } from './helpers/forecast';
import { expectNoHorizontalScroll, setWidth } from './helpers/layout';
import { fixtures, overrideApiJson, seedSettings } from './helpers/weather-fixtures';

test.use({ bypassCSP: true });

const { localDate } = fixtures;
const NOW = Date.now();
const iso = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

/** 24 hours: low drizzle chances everywhere except one real shower at +5 h. */
const HOURLY = Array.from({ length: 24 }, (_, index) => ({
  time: iso(index),
  temp: 14 + Math.round(4 * Math.sin((index / 24) * Math.PI)),
  icon: '04d',
  description: 'kapalı',
  pop: index === 5 ? 70 : [3, 5, 8, 4][index % 4],
  precipitationMm: index === 5 ? 2.4 : 0,
  windSpeed: 3,
}));

const DAILY = [
  { date: localDate(0), tempMin: 12, tempMax: 20, icon: '04d', description: 'kapalı', pop: 8, precipitationMm: 0.1 },
  { date: localDate(1), tempMin: 15, tempMax: 21, icon: '04d', description: 'kapalı', pop: 0 },
  { date: localDate(2), tempMin: 15, tempMax: 21, icon: '03d', description: 'parçalı bulutlu', pop: 0 },
  { date: localDate(3), tempMin: 16, tempMax: 18, icon: '10d', description: 'yağmurlu', pop: 40, precipitationMm: 6.3 },
  { date: localDate(4), tempMin: 18, tempMax: 21, icon: '10d', description: 'yağmurlu', pop: 34, precipitationMm: 0.5 },
];

const TR_WEEKDAYS = /Pazartesi|Salı|Çarşamba|Perşembe|Cuma|Cumartesi|Pazar/;

async function openForecast(page: Page) {
  await overrideApiJson(page, 'forecast', { ...fixtures.forecast, daily: DAILY });
  await overrideApiJson(page, 'hourly', { ...fixtures.hourlyForecast, hourly: HOURLY, daily: DAILY });
  await page.goto('/istanbul/');
  await ensureForecastAtlasLoaded(page);
  const atlas = page.locator('.hava81-forecast-atlas').first();
  await atlas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  return atlas;
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value, 'element has a layout box').not.toBeNull();
  return value!;
}

const visibleCount = (locator: Locator) =>
  locator.evaluateAll(
    elements =>
      elements.filter(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          parseFloat(style.opacity) > 0.05 &&
          rect.width > 0 &&
          rect.height > 0
        );
      }).length
  );

test.describe('forecast design contract', () => {
  test('the screen has one "now": chart point and hour strip agree', DESKTOP, async ({ page }) => {
    const atlas = await openForecast(page);
    const stripNow = atlas.locator('.hava81-forecast-atlas__hour.is-current strong');
    const chartNow = atlas.locator('.hava81-forecast-atlas__point.is-current');
    await expect(stripNow).toHaveCount(1);
    await expect(chartNow).toHaveCount(1);
    const stripValue = (await stripNow.textContent())!.replace(/[^\d-]/g, '');
    await expect(chartNow).toHaveAttribute('data-temp', stripValue);
  });

  test('the curve marks only now, the low and the high', DESKTOP, async ({ page }) => {
    const atlas = await openForecast(page);
    const marks = atlas.locator('.hava81-forecast-atlas__point');
    expect(await marks.count()).toBe(24);
    expect(await visibleCount(marks), 'visible markers').toBeLessThanOrEqual(3);
    expect(await visibleCount(marks), 'visible markers').toBeGreaterThanOrEqual(2);
  });

  test('rain shows only where it matters', DESKTOP, async ({ page }) => {
    const atlas = await openForecast(page);
    const hours = atlas.locator('.hava81-forecast-atlas__hour');
    // Low single-digit chances are noise: no percentage under those hours.
    for (const index of [1, 2, 3, 4, 6, 7]) {
      await expect(hours.nth(index).locator('.hava81-forecast-atlas__hour-pop')).toHaveCount(0);
    }
    // The real shower is labelled.
    await expect(hours.nth(5).locator('.hava81-forecast-atlas__hour-pop')).toContainText('70');
    // The rain gauge lights only for the shower hour.
    const litColumns = await atlas
      .locator('.hava81-forecast-atlas__rain-gauge')
      .evaluateAll(columns =>
        columns.filter(column => column.querySelector('.hava81-forecast-atlas__rain-bar.is-lit')).length
      );
    expect(litColumns, 'lit rain columns').toBe(1);
  });

  test('one quiet scroll control and no shouting labels', DESKTOP, async ({ page }) => {
    const atlas = await openForecast(page);
    expect(await visibleCount(atlas.locator('.hava81-forecast-atlas__scroll-progress'))).toBe(0);
    expect(await visibleCount(atlas.locator('.hava81-forecast-atlas__scroll-hint'))).toBe(0);
    await expect(atlas.getByRole('button', { name: /sonraki|next/i })).toBeVisible();
    // The unit chip duplicates the settings and the values themselves.
    expect(await visibleCount(atlas.locator('.hava81-forecast-atlas__unit'))).toBe(0);
    const shouting = await atlas.evaluate(root =>
      Array.from(root.querySelectorAll<HTMLElement>('*')).filter(element => {
        const style = getComputedStyle(element);
        return (
          style.textTransform === 'uppercase' &&
          parseFloat(style.letterSpacing) > 0.5 &&
          (element.textContent ?? '').trim().length > 2 &&
          element.offsetParent !== null
        );
      }).length
    );
    expect(shouting, 'uppercase letter-spaced labels').toBe(0);
    // Attribution is a footnote.
    const source = atlas.locator('.hava81-forecast-atlas__source').first();
    expect(
      await source.evaluate(element => parseFloat(getComputedStyle(element).fontSize))
    ).toBeLessThanOrEqual(12.5);
  });

  test('the 5-day forecast is its own surface', DESKTOP, async ({ page }) => {
    const atlas = await openForecast(page);
    const days = atlas.locator('.hava81-forecast-atlas__days');
    const surface = days.locator('xpath=ancestor-or-self::*[@data-surface="daily"][1]');
    await expect(surface).toHaveCount(1);
    const styles = await surface.evaluate(element => {
      const style = getComputedStyle(element);
      return { radius: parseFloat(style.borderTopLeftRadius), background: style.backgroundColor };
    });
    expect(styles.radius).toBeGreaterThanOrEqual(16);
    expect(styles.background).not.toBe('rgba(0, 0, 0, 0)');
    const hourly = atlas.locator('.hava81-forecast-atlas__hourly-viewport');
    const gap = (await box(surface)).y - ((await box(hourly)).y + (await box(hourly)).height);
    expect(gap, 'separated from the hourly chart').toBeGreaterThanOrEqual(16);
  });

  test('day rows lead with the weekday and keep rain for meaningful days', DESKTOP, async ({ page }) => {
    const atlas = await openForecast(page);
    const rows = atlas.locator('.hava81-forecast-atlas__day');
    await expect(rows).toHaveCount(5);
    for (const index of [2, 3, 4]) {
      await expect(rows.nth(index).locator('.hava81-forecast-atlas__day-name')).toContainText(TR_WEEKDAYS);
    }
    // 8% · 0.1 mm today is not news; 40% · 6.3 mm is.
    await expect(rows.nth(0).locator('.hava81-forecast-atlas__day-pop')).toHaveCount(0);
    await expect(rows.nth(3).locator('.hava81-forecast-atlas__day-pop')).toContainText('40');
  });

  test('range bars use absolute temperature colours and mark now on today', DESKTOP, async ({ page }) => {
    const atlas = await openForecast(page);
    const bars = atlas.locator('.hava81-forecast-atlas__day-range');
    const fills = await bars.evaluateAll(elements =>
      elements.map(element => {
        const target = (element.firstElementChild as HTMLElement | null) ?? element;
        const own = getComputedStyle(element).backgroundImage;
        const child = getComputedStyle(target).backgroundImage;
        const before = getComputedStyle(element, '::before').backgroundImage;
        return [own, child, before].find(value => value && value !== 'none') ?? 'none';
      })
    );
    // Tomorrow and the day after share 15–21°: same colours. Today (12–20°) differs.
    expect(fills[1]).toBe(fills[2]);
    expect(fills[0]).not.toBe(fills[1]);
    const marker = atlas.locator('.hava81-forecast-atlas__day').first().locator('[data-now-marker]');
    await expect(marker).toBeVisible();
  });

  test('day icons are legible, not thin glyphs in empty rings', DESKTOP, async ({ page }) => {
    const atlas = await openForecast(page);
    const symbol = atlas.locator('.hava81-forecast-atlas__day-symbol').first();
    const metrics = await symbol.evaluate(element => {
      const svg = element.querySelector('svg') ?? element;
      const rect = svg.getBoundingClientRect();
      return { size: Math.min(rect.width, rect.height), border: parseFloat(getComputedStyle(element).borderTopWidth) };
    });
    expect(metrics.size).toBeGreaterThanOrEqual(28);
    expect(metrics.border).toBe(0);
  });

  test('forecast passes axe in light and dark themes', DESKTOP, async ({ page }) => {
    for (const themeMode of ['light', 'dark'] as const) {
      await seedSettings(page, { themeMode });
      await openForecast(page);
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const failures = await page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: {
              run: (
                context: unknown,
                options: unknown
              ) => Promise<{ violations: Array<{ id: string; nodes: Array<{ target: string[] }> }> }>;
            };
          }
        ).axe;
        const result = await axe.run(
          { include: [['.hava81-forecast-atlas']] },
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
      });
      expect(failures, `${themeMode} theme`).toEqual([]);
    }
  });

  test('phone forecast stays readable without sideways page scroll', MOBILE, async ({ page }) => {
    await openForecast(page);
    await expectNoHorizontalScroll(page, '390px');
    await setWidth(page, 320, 844);
    await expectNoHorizontalScroll(page, '320px');
  });
});
