/**
 * Design contract for the app header (masthead).
 *
 * FROZEN: written before the redesign and not edited afterwards. The implementation
 * has to satisfy these checks as written; if a check is wrong, raise it with the owner
 * instead of changing it. No check depends on the wall-clock time.
 */
import type { Locator, Page } from '@playwright/test';
import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import { ensureForecastAtlasLoaded } from './helpers/forecast';
import { expectNoHorizontalScroll, setWidth } from './helpers/layout';
import { seedSettings } from './helpers/weather-fixtures';

test.use({ bypassCSP: true });

async function openToday(page: Page) {
  await page.goto('/istanbul/');
  await ensureForecastAtlasLoaded(page);
  await expect(page.locator('.atlas-header')).toBeVisible();
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value, 'element has a layout box').not.toBeNull();
  return value!;
}

async function scrollDown(page: Page, y = 900) {
  await page.evaluate(top => window.scrollTo(0, top), y);
  await page.waitForTimeout(450);
}

test.describe('header design contract', () => {
  test('masthead reads as one brand, primary navigation and a quiet tool group', DESKTOP, async ({ page }) => {
    await openToday(page);
    const header = page.locator('.atlas-header');
    expect((await box(header)).height, 'masthead height at the top').toBeLessThanOrEqual(80);

    // The wordmark stands alone: no boxed badge next to it.
    const brand = header.locator('.atlas-brand');
    await expect(brand).toHaveAttribute('href', '/');
    await expect(brand).toContainText('Hava81');
    await expect(header.locator('.atlas-brand__index')).toHaveCount(0);

    // Desktop primary navigation mirrors the app's views, with the current one marked.
    const nav = header.getByRole('navigation');
    await expect(nav).toBeVisible();
    const items = nav.locator('a, button');
    expect(await items.count()).toBeGreaterThanOrEqual(3);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.locator('[aria-current="page"]')).toContainText(/Bugün|Today/);

    // Search is a field among peers, not the dominant block, and advertises its shortcut.
    const search = header.locator('.atlas-header__search');
    const searchWidth = (await box(search)).width;
    expect(searchWidth).toBeGreaterThanOrEqual(240);
    expect(searchWidth).toBeLessThanOrEqual(520);
    await expect(search.locator('kbd')).toBeVisible();

    // Tools: at most four visible controls, each a named 40px+ target.
    const tools = header.locator('.atlas-header__actions').locator('button:visible, a:visible');
    const count = await tools.count();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(4);
    for (let index = 0; index < count; index += 1) {
      const tool = tools.nth(index);
      const b = await box(tool);
      expect(Math.min(b.width, b.height), `tool ${index} target`).toBeGreaterThanOrEqual(40);
      const name = await tool.evaluate(
        element => element.getAttribute('aria-label') ?? element.textContent ?? ''
      );
      expect(name.trim().length, `tool ${index} name`).toBeGreaterThan(0);
    }
  });

  test('navigation moves between views and follows the current one', DESKTOP, async ({ page }) => {
    await openToday(page);
    const nav = page.locator('.atlas-header').getByRole('navigation');
    await nav.getByRole('button', { name: /Planla|Plan/ }).click();
    await expect(page).toHaveURL(/view=plan/);
    await expect(nav.locator('[aria-current="page"]')).toContainText(/Planla|Plan/);
    await nav.getByRole('button', { name: /Bugün|Today/ }).click();
    await expect(page).not.toHaveURL(/view=plan/);
    await expect(nav.locator('[aria-current="page"]')).toContainText(/Bugün|Today/);
  });

  test('keyboard shortcut focuses the search field', DESKTOP, async ({ page }) => {
    await openToday(page);
    await page.locator('body').click({ position: { x: 5, y: 400 } });
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.locator('.atlas-header .search-bar__input')).toBeFocused();
  });

  test('scrolling condenses the masthead and reveals the live context line', DESKTOP, async ({ page }) => {
    await openToday(page);
    const header = page.locator('.atlas-header');
    const context = header.getByTestId('header-context');
    // At the top the hero already shows the city, so the context line stays hidden.
    await expect(header).not.toHaveAttribute('data-condensed', 'true');
    await expect(context).toBeHidden();

    await scrollDown(page);
    await expect(header).toHaveAttribute('data-condensed', 'true');
    const condensed = await box(header);
    expect(condensed.y, 'header stays pinned').toBeLessThanOrEqual(1);
    expect(condensed.height, 'condensed height').toBeLessThanOrEqual(64);
    await expect(context).toBeVisible();
    await expect(context).toContainText('İstanbul');
    await expect(context).toContainText(/\d+°/);
    const heroTemperature = (
      await page.locator('.hava81-decision-field__temperature-value').first().textContent()
    )?.trim();
    expect(heroTemperature).toBeTruthy();
    await expect(context).toContainText(`${heroTemperature}°`);

    await scrollDown(page, 0);
    await expect(header).not.toHaveAttribute('data-condensed', 'true');
  });

  test('header passes axe in light and dark themes, at rest and condensed', DESKTOP, async ({ page }) => {
    for (const themeMode of ['light', 'dark'] as const) {
      await seedSettings(page, { themeMode });
      await openToday(page);
      for (const y of [0, 900]) {
        await scrollDown(page, y);
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
            { include: [['.atlas-header']] },
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
        expect(failures, `${themeMode} theme, scroll ${y}`).toEqual([]);
      }
    }
  });

  test('reduced motion keeps the header still', DESKTOP, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openToday(page);
    await scrollDown(page);
    const running = await page.evaluate(() => {
      const root = document.querySelector('.atlas-header');
      if (!root) return -1;
      return [root, ...Array.from(root.querySelectorAll('*'))].flatMap(element =>
        element.getAnimations().filter(animation => animation.playState === 'running')
      ).length;
    });
    expect(running).toBe(0);
  });

  test('phone masthead stays compact and leaves navigation to the dock', MOBILE, async ({ page }) => {
    await openToday(page);
    const header = page.locator('.atlas-header');
    expect((await box(header)).height).toBeLessThanOrEqual(64);
    await expect(header.getByRole('navigation')).toBeHidden();
    await expect(header.locator('.atlas-icon-button--search')).toBeVisible();
    await expect(header.locator('.atlas-brand__index')).toHaveCount(0);
    await expectNoHorizontalScroll(page, '390px');
    await setWidth(page, 320, 844);
    await expectNoHorizontalScroll(page, '320px');
  });
});
