/**
 * Design contract for the full-screen phone map and the closing footer.
 *
 * FROZEN: written before the redesign and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it. Data and tiles come from the fixtures.
 */
import type { Locator, Page } from '@playwright/test';
import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import { mockMapTiles, seedSettings } from './helpers/weather-fixtures';

test.use({ bypassCSP: true });

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value, 'element has a layout box').not.toBeNull();
  return value!;
}

const inside = (
  inner: { x: number; y: number; width: number; height: number },
  outer: typeof inner
) =>
  inner.x >= outer.x - 1 &&
  inner.y >= outer.y - 1 &&
  inner.x + inner.width <= outer.x + outer.width + 1 &&
  inner.y + inner.height <= outer.y + outer.height + 1;

async function openPhoneMap(page: Page) {
  await mockMapTiles(page);
  await page.goto('/izmir/?view=map');
  const map = page.locator('.leaflet-container');
  await expect(map).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);
  return map;
}

async function runAxe(page: Page, selectors: string[]) {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  return page.evaluate(async include => {
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
    const present = include.filter(selector => document.querySelector(selector));
    const result = await axe.run(
      { include: present.map(selector => [selector]) },
      {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'],
        },
      }
    );
    return result.violations.flatMap(violation =>
      violation.nodes.map(node => `${violation.id} — ${node.target.join(', ')}`)
    );
  }, selectors);
}

test.describe('phone map and footer contract', () => {
  test.describe('on a touch phone', () => {
    test.use({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      userAgent: IPHONE_UA,
    });

    test(
      'the map fills the screen between the header and a bottom bar that stays',
      MOBILE,
      async ({ page }) => {
        const map = await openPhoneMap(page);
        const nav = page.locator('.atlas-bottom-nav');
        await expect(nav, 'the bottom bar does not disappear on the map').toBeVisible();
        await expect(nav.getByRole('button', { name: 'Harita', exact: true })).toHaveAttribute(
          'aria-current',
          /page|true/
        );
        const header = await box(page.locator('.atlas-header'));
        const mapBox = await box(map);
        const navBox = await box(nav);
        expect(
          Math.abs(mapBox.y - (header.y + header.height)),
          'map starts under the header'
        ).toBeLessThanOrEqual(4);
        expect(
          navBox.y - (mapBox.y + mapBox.height),
          'map runs down to the bottom bar'
        ).toBeLessThanOrEqual(24);
        expect(mapBox.width).toBeGreaterThanOrEqual(388);
        expect(mapBox.height).toBeGreaterThanOrEqual(844 * 0.6);
      }
    );

    test('the page itself does not scroll under the map', MOBILE, async ({ page }) => {
      await openPhoneMap(page);
      const metrics = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
      }));
      expect(metrics.scrollHeight, 'no page scroll to fight the map').toBeLessThanOrEqual(
        metrics.innerHeight + 1
      );
    });

    test('title and close float over the map as touch targets', MOBILE, async ({ page }) => {
      const map = await openPhoneMap(page);
      const mapBox = await box(map);
      const title = page.getByRole('heading', { level: 1, name: /harita/i });
      await expect(title).toBeVisible();
      expect(inside(await box(title), mapBox), 'title sits on the map').toBe(true);
      const close = page.locator('#weather-map-region').getByRole('button', { name: /kapat/i });
      await expect(close).toBeVisible();
      const closeBox = await box(close);
      expect(inside(closeBox, mapBox), 'close sits on the map').toBe(true);
      expect(Math.min(closeBox.width, closeBox.height)).toBeGreaterThanOrEqual(44);
    });

    test(
      'legend is one compact strip and attribution a small caption, both on the map',
      MOBILE,
      async ({ page }) => {
        const map = await openPhoneMap(page);
        const mapBox = await box(map);
        const legend = page.locator('.weather-map__legend');
        const legendBox = await box(legend);
        expect(inside(legendBox, mapBox), 'legend floats on the map').toBe(true);
        expect(legendBox.height, 'legend is one strip').toBeLessThanOrEqual(72);
        const items = legend.locator('[role="listitem"]');
        await expect(items).toHaveCount(5);
        const tops = await items.evaluateAll(elements =>
          elements.map(element => Math.round(element.getBoundingClientRect().top))
        );
        expect(Math.max(...tops) - Math.min(...tops), 'one row').toBeLessThanOrEqual(2);
        const attribution = page.locator('.weather-map__attribution');
        await expect(attribution).toContainText('OpenStreetMap');
        expect(inside(await box(attribution), mapBox), 'attribution sits on the map').toBe(true);
        expect(
          await attribution.evaluate(element => parseFloat(getComputedStyle(element).fontSize))
        ).toBeLessThanOrEqual(12);
      }
    );

    test(
      'closing the map returns to today with the footer above the bottom bar',
      MOBILE,
      async ({ page }) => {
        await openPhoneMap(page);
        await page.locator('#weather-map-region').getByRole('button', { name: /kapat/i }).click();
        await expect(page.locator('.environment-rail')).toBeVisible();
        const footer = page.getByTestId('app-footer');
        await footer.scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(300);
        const footerBox = await box(footer);
        const navBox = await box(page.locator('.atlas-bottom-nav'));
        expect(
          footerBox.y + footerBox.height,
          'footer is not hidden behind the bottom bar'
        ).toBeLessThanOrEqual(navBox.y + 1);
        await expect(footer.locator('[data-footer-wordmark]')).toBeVisible();
      }
    );

    test('phone map and footer pass axe in light and dark', MOBILE, async ({ page }) => {
      for (const themeMode of ['light', 'dark'] as const) {
        await seedSettings(page, { themeMode });
        await openPhoneMap(page);
        expect(
          await runAxe(page, ['#weather-map-region', '.atlas-bottom-nav']),
          `${themeMode} map`
        ).toEqual([]);
      }
    });
  });

  test('the footer closes the page like an editorial colophon', DESKTOP, async ({ page }) => {
    await page.goto('/istanbul/');
    const footer = page.getByTestId('app-footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    const wordmark = footer.locator('[data-footer-wordmark]');
    await expect(wordmark).toBeVisible();
    await expect(wordmark).toContainText(/Hava\s*81/);
    expect(
      await wordmark.evaluate(element => parseFloat(getComputedStyle(element).fontSize)),
      'the wordmark carries the close'
    ).toBeGreaterThanOrEqual(24);
    // Credits are real links to the data and map sources.
    await expect(footer.getByRole('link', { name: /Open-Meteo/ })).toHaveAttribute(
      'href',
      /open-meteo/
    );
    await expect(footer.getByRole('link', { name: /OpenStreetMap/ })).toHaveAttribute(
      'href',
      /openstreetmap/
    );
    // One calm row: wordmark, credits and shortcuts share a line.
    const parts = await footer.locator(':scope > *').evaluateAll(elements =>
      elements.map(element => {
        const rect = element.getBoundingClientRect();
        return rect.top + rect.height / 2;
      })
    );
    expect(parts.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...parts) - Math.min(...parts), 'one row on desktop').toBeLessThanOrEqual(12);
    for (const themeMode of ['light', 'dark'] as const) {
      await seedSettings(page, { themeMode });
      await page.goto('/istanbul/');
      await page.getByTestId('app-footer').scrollIntoViewIfNeeded();
      expect(await runAxe(page, ['[data-testid="app-footer"]']), `${themeMode} footer`).toEqual([]);
    }
  });
});
