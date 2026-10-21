import type { Locator, Page } from '@playwright/test';
import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import {
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectReachable,
  expectTextNotClipped,
  expectTouchTarget,
  expectWithinViewportWidth,
  setTextScale,
  setWidth,
} from './helpers/layout';

// Header (brand, search, actions) and the search suggestion list.

/** Moving to the last suggestion scrolls the list itself, not the page, and keeps the option visible. */
async function expectSuggestionsUsable(page: Page, input: Locator, list: Locator) {
  await expect(list).toBeVisible();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await input.press('End');
  const active = list.locator('[aria-selected="true"]');
  await expect(active).toBeVisible();
  await expect(input).toHaveAttribute(
    'aria-activedescendant',
    (await active.getAttribute('id')) ?? ''
  );
  await expect(list).toBeInViewport({ ratio: 1 });
  await expect(active).toBeInViewport();
  expect(
    await list.evaluate(element => element.scrollTop),
    'list scrolls internally'
  ).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY), 'page does not jump').toBe(scrollBefore);
  await expectNoHorizontalScroll(page);
}

test.describe('search suggestions', () => {
  test(
    'short desktop viewport keeps suggestions inside the viewport at 200% text',
    DESKTOP,
    async ({ page }) => {
      await setWidth(page, 1280, 320);
      await page.goto('/istanbul');
      await setTextScale(page, 200);
      const input = page.locator('.search-bar__input:visible').first();
      await input.fill('is');
      await expectSuggestionsUsable(
        page,
        input,
        page.locator('.search-bar__suggestions:visible').first()
      );
    }
  );

  test(
    'short mobile landscape search takes over the screen and Escape restores it',
    MOBILE,
    async ({ page }) => {
      await setWidth(page, 568, 320);
      await page.goto('/istanbul');
      await setTextScale(page, 200);
      const toggle = page.getByRole('button', { name: /şehir ara|city search/i });
      await toggle.click();
      const nav = page.locator('.atlas-bottom-nav');
      await expect(nav).toBeHidden();

      const input = page.locator('.search-bar__input:visible').first();
      await input.fill('is');
      await expectSuggestionsUsable(
        page,
        input,
        page.locator('.search-bar__suggestions:visible').first()
      );

      await input.press('Escape');
      await expect(nav).toBeVisible();
      await expect(toggle).toBeFocused();
    }
  );
});

test.describe('header', () => {
  test(
    'desktop header keeps search readable and settings reachable at 200% text',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/istanbul');
      await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
      await setTextScale(page, 200);

      const search = page.locator('.atlas-header__search');
      const actions = page.locator('.atlas-header__actions');
      const settings = page.locator('.atlas-settings-button');
      await expect(search).toBeVisible();
      await expect(actions).toBeVisible();
      await expectNoOverlap(search, actions, 'search vs actions');
      await expectTextNotClipped(search, 'search');
      // The placeholder is fully readable in the enlarged input.
      const placeholderFits = await page.locator('.search-bar__input').evaluate(element => {
        const input = element as HTMLInputElement;
        const style = getComputedStyle(input);
        const context = document.createElement('canvas').getContext('2d');
        if (!context) return false;
        context.font = style.font;
        return (
          context.measureText(input.placeholder).width <=
          input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) + 1
        );
      });
      expect(placeholderFits, 'placeholder fits the input').toBe(true);
      await expectReachable(settings, 'settings');
      await expectNoHorizontalScroll(page);

      await settings.click();
      await expect(page.getByRole('dialog', { name: /ayarlar|settings/i })).toBeVisible();
    }
  );

  test(
    'tablet header stays usable across widths at 100% and 200% text',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/izmir/');
      const brand = page.locator('.atlas-brand');
      const search = page.locator('.atlas-header__search');
      const actions = page.locator('.atlas-header__actions');
      await expect(search).toBeVisible();

      for (const width of [768, 900, 1024, 1152]) {
        await setWidth(page, width, 900);
        for (const scale of [100, 200] as const) {
          await setTextScale(page, scale);
          const at = `${width}px/${scale}%`;
          await expectNoOverlap(brand, search, `brand vs search ${at}`);
          await expectNoOverlap(search, actions, `search vs actions ${at}`);
          await expectNoOverlap(brand, actions, `brand vs actions ${at}`);
          for (const region of [search, actions]) await expectWithinViewportWidth(region, at);
          expect((await search.boundingBox())!.width, `search stays usable ${at}`).toBeGreaterThan(
            100
          );
          await expectTextNotClipped(search, at);
          await expectReachable(page.locator('.atlas-settings-button'), `settings ${at}`);
          await expectNoHorizontalScroll(page, at);
        }
      }
    }
  );

  test(
    'phone header keeps every quick action reachable from 280px to 390px at 100% and 200% text',
    MOBILE,
    async ({ page }) => {
      await page.goto('/izmir/');
      const brand = page.locator('.atlas-brand');
      const actions = page.locator('.atlas-header__actions');
      await expect(actions).toBeVisible();
      const location = page.locator('.atlas-icon-button--location');
      await expect(location).toHaveAttribute('aria-label', /konum/i);
      await expect(location).toHaveAttribute('aria-busy', 'false');

      for (const width of [280, 320, 390]) {
        await setWidth(page, width, 844);
        for (const scale of [100, 200] as const) {
          await setTextScale(page, scale);
          const at = `${width}px/${scale}%`;
          await expectNoOverlap(brand, actions, `brand vs actions ${at}`);
          const buttons = await actions.locator('button:visible').all();
          expect(buttons.length, `quick actions ${at}`).toBeGreaterThanOrEqual(4);
          for (const button of buttons) {
            await expectWithinViewportWidth(button, at);
            await expectTouchTarget(button, at);
            await expectReachable(button, at);
          }
          await expectNoHorizontalScroll(page, at);
        }
      }

      await setWidth(page, 320, 844);
      const searchToggle = page.locator('.atlas-icon-button--search');
      await searchToggle.click();
      await expect(searchToggle).toHaveAttribute('aria-expanded', 'true');
      const search = page.locator('.atlas-header__search');
      await expect(search).toBeVisible();
      await expectWithinViewportWidth(search, 'opened search');
      await expectTextNotClipped(search, 'opened search');
      await expectNoHorizontalScroll(page, 'opened search');
    }
  );
});
