/**
 * Design contract for the environment instruments, the footer and the phone map.
 *
 * FROZEN: written before the redesign and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it. Data comes from the shared fixtures.
 */
import type { Locator, Page } from '@playwright/test';
import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import { expectNoHorizontalScroll, setWidth } from './helpers/layout';
import { seedSettings } from './helpers/weather-fixtures';

test.use({ bypassCSP: true });

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

async function openToday(page: Page) {
  await page.goto('/istanbul/');
  const rail = page.locator('.environment-rail');
  await expect(rail).toBeVisible({ timeout: 15_000 });
  await rail.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  return rail;
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value, 'element has a layout box').not.toBeNull();
  return value!;
}

const isTransparent = (color: string) => color === 'rgba(0, 0, 0, 0)' || color === 'transparent';

test.describe('instruments, footer and phone map contract', () => {
  test('the four instruments share one surface instead of four floating cards', DESKTOP, async ({ page }) => {
    const rail = await openToday(page);
    const surface = await rail.evaluate(element => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, radius: parseFloat(style.borderTopLeftRadius) };
    });
    expect(isTransparent(surface.background), 'panel has its own surface').toBe(false);
    expect(surface.radius).toBeGreaterThanOrEqual(16);
    const cells = await rail.locator('[data-testid^="instrument-"]').evaluateAll(elements =>
      elements.map(element => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, shadow: style.boxShadow };
      })
    );
    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      expect(isTransparent(cell.background), 'cells sit on the shared surface').toBe(true);
      expect(cell.shadow === 'none' || cell.shadow === '', 'cells do not float').toBe(true);
    }
  });

  test('values read as words and numbers, not codes', DESKTOP, async ({ page }) => {
    const rail = await openToday(page);
    const wind = rail.getByTestId('instrument-wind');
    // The speed leads; the direction is spelled out in the detail, never a lone letter.
    await expect(wind.locator('.environment-rail__value')).toHaveText(/^\d/);
    await expect(wind.locator('.environment-rail__detail')).toContainText(/den|from/i);
    const aqi = rail.getByTestId('instrument-aqi');
    const aqiValue = (await aqi.locator('.environment-rail__value').textContent()) ?? '';
    expect(aqiValue, 'air quality leads with its word').not.toMatch(/\//);
    expect(aqiValue.trim().length).toBeGreaterThan(2);
    await expect(aqi.locator('.environment-rail__detail')).toContainText(/2\s*\/\s*5/);
  });

  test('phone instruments form an even 2 × 2 grid with aligned drawings', MOBILE, async ({ page }) => {
    const rail = await openToday(page);
    const cells = rail.locator('[data-testid^="instrument-"]');
    const boxes = await Promise.all([0, 1, 2, 3].map(index => box(cells.nth(index))));
    expect(Math.abs(boxes[0].y - boxes[1].y), 'row 1 aligned').toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[2].y - boxes[3].y), 'row 2 aligned').toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[0].height - boxes[1].height), 'row 1 equal').toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[2].height - boxes[3].height), 'row 2 equal').toBeLessThanOrEqual(1);
    const drawings = await Promise.all(
      [0, 1, 2, 3].map(index => box(cells.nth(index).locator('.environment-rail__icon')))
    );
    const heights = drawings.map(item => Math.round(item.height));
    expect(Math.max(...heights) - Math.min(...heights), 'drawings share one height').toBeLessThanOrEqual(1);
    const tops = drawings.map((item, index) => item.y - boxes[index].y);
    expect(Math.max(...tops) - Math.min(...tops), 'drawings start at one line').toBeLessThanOrEqual(1);
    await expectNoHorizontalScroll(page, '390px');
    await setWidth(page, 320, 844);
    await expectNoHorizontalScroll(page, '320px');
  });

  test('the footer is a colophon aligned with the content, not a floating box', DESKTOP, async ({ page }) => {
    const rail = await openToday(page);
    const footer = page.getByTestId('app-footer');
    await footer.scrollIntoViewIfNeeded();
    const style = await footer.evaluate(element => {
      const computed = getComputedStyle(element);
      return { background: computed.backgroundColor, radius: parseFloat(computed.borderTopLeftRadius) };
    });
    expect(isTransparent(style.background), 'no box behind the footer').toBe(true);
    expect(style.radius).toBe(0);
    const railBox = await box(rail);
    const footerBox = await box(footer);
    expect(Math.abs(footerBox.x - railBox.x), 'left edges align').toBeLessThanOrEqual(2);
    expect(
      Math.abs(footerBox.x + footerBox.width - (railBox.x + railBox.width)),
      'right edges align'
    ).toBeLessThanOrEqual(2);
  });

  test.describe('on a touch phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: IPHONE_UA });

    test('footer drops keyboard hints on touch screens', MOBILE, async ({ page }) => {
      await openToday(page);
      const footer = page.getByTestId('app-footer');
      if ((await footer.count()) === 0) return;
      const visibleKeys = await footer
        .locator('kbd')
        .evaluateAll(keys => keys.filter(key => (key as HTMLElement).offsetParent !== null).length);
      expect(visibleKeys).toBe(0);
    });

    test('the map card opens a full-screen map, not a box inside the page', MOBILE, async ({ page }) => {
      const rail = await openToday(page);
      await rail.getByTestId('instrument-map').click();
      const map = page.locator('.leaflet-container');
      await expect(map).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/view=map/);
      await page.waitForTimeout(500);
      const mapBox = await box(map);
      expect(mapBox.height, 'map fills the phone').toBeGreaterThanOrEqual(844 * 0.55);
      expect(mapBox.width).toBeGreaterThanOrEqual(390 - 2);
      // The today content is out of the way, so a page swipe cannot fight the map.
      await expect(page.getByTestId('decision-glance')).toBeHidden();
      await expect(rail).toBeHidden();
      await expectNoHorizontalScroll(page, '390px');
    });

    test('map tiles render seamlessly and loading is not repeated on pan', MOBILE, async ({ page }) => {
      const rail = await openToday(page);
      await rail.getByTestId('instrument-map').click();
      const map = page.locator('.leaflet-container');
      await expect(map).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('img.leaflet-tile-loaded').first()).toBeVisible({ timeout: 15_000 });
      const rendering = await page
        .locator('img.leaflet-tile')
        .first()
        .evaluate(tile => getComputedStyle(tile).imageRendering);
      expect(rendering, 'no seam-prone tile smoothing on phones').toBe('auto');
      await page.waitForTimeout(800);
      const mapBox = await box(map);
      await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(mapBox.x + mapBox.width / 2 - 160, mapBox.y + mapBox.height / 2 - 120, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(60);
      await expect(page.getByText(/Harita hazırlanıyor|Loading map tiles/i)).toBeHidden();
    });
  });

  test('lower surfaces and the map pass axe in light and dark', DESKTOP, async ({ page }) => {
    for (const themeMode of ['light', 'dark'] as const) {
      await seedSettings(page, { themeMode });
      const rail = await openToday(page);
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const run = () =>
        page.evaluate(async () => {
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
          const include = [
            '.environment-rail',
            '[data-testid="app-footer"]',
            '#weather-map-region',
          ].filter(selector => document.querySelector(selector));
          const result = await axe.run(
            { include: include.map(selector => [selector]) },
            { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } }
          );
          return result.violations.flatMap(violation =>
            violation.nodes.map(node => `${violation.id} — ${node.target.join(', ')}`)
          );
        });
      expect(await run(), `${themeMode} today`).toEqual([]);
      await rail.getByTestId('instrument-map').click();
      await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(600);
      expect(await run(), `${themeMode} map`).toEqual([]);
    }
  });
});
