/**
 * Design contract for the settings surface.
 *
 * FROZEN: written before the redesign and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it. No check depends on the wall clock.
 *
 * Intent: four rarely changed preferences do not deserve a full-height drawer. On
 * desktop they open as a popover anchored to the settings button; on phones as a
 * bottom sheet. Choices are one-row segmented controls with a live preview.
 */
import type { Locator, Page } from '@playwright/test';
import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import { ensureForecastAtlasLoaded } from './helpers/forecast';
import { expectNoHorizontalScroll } from './helpers/layout';
import { seedSettings } from './helpers/weather-fixtures';

test.use({ bypassCSP: true });

async function openSettings(page: Page) {
  await page.goto('/istanbul/');
  await ensureForecastAtlasLoaded(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const trigger = page.locator('.atlas-settings-button');
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: /Ayarlar|Settings/ });
  await expect(dialog).toBeVisible();
  // Let any entrance motion settle before measuring.
  await page.waitForTimeout(450);
  return { trigger, dialog };
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value, 'element has a layout box').not.toBeNull();
  return value!;
}

test.describe('settings design contract', () => {
  test('desktop settings open as a popover anchored to the trigger', DESKTOP, async ({ page }) => {
    const { trigger, dialog } = await openSettings(page);
    const t = await box(trigger);
    const d = await box(dialog);
    const viewport = page.viewportSize()!;

    expect(d.width, 'popover width').toBeGreaterThanOrEqual(320);
    expect(d.width, 'popover width').toBeLessThanOrEqual(420);
    expect(d.height, 'not a full-height drawer').toBeLessThanOrEqual(viewport.height * 0.8);
    expect(d.y - (t.y + t.height), 'opens just below the trigger').toBeGreaterThanOrEqual(0);
    expect(d.y - (t.y + t.height), 'opens just below the trigger').toBeLessThanOrEqual(16);
    expect(Math.abs(d.x + d.width - (t.x + t.width)), 'right edges align').toBeLessThanOrEqual(24);

    // Compact heading row with a 40px+ close control.
    const heading = dialog.getByRole('heading', { name: /Ayarlar|Settings/ });
    expect((await box(heading)).y - d.y, 'heading sits at the top').toBeLessThanOrEqual(32);
    const close = dialog.getByRole('button', { name: /Kapat|Close/ });
    const c = await box(close);
    expect(Math.min(c.width, c.height)).toBeGreaterThanOrEqual(40);
  });

  test('every preference is a one-row segmented control with one active choice', DESKTOP, async ({ page }) => {
    const { dialog } = await openSettings(page);
    const groups = dialog.getByRole('group');
    await expect(groups).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) {
      const options = groups.nth(index).getByRole('button');
      const count = await options.count();
      expect(count).toBeGreaterThanOrEqual(2);
      const boxes = await Promise.all(
        Array.from({ length: count }, (_, i) => box(options.nth(i)))
      );
      const tops = boxes.map(b => Math.round(b.y));
      const heights = boxes.map(b => Math.round(b.height));
      expect(Math.max(...tops) - Math.min(...tops), `group ${index} on one row`).toBeLessThanOrEqual(1);
      expect(Math.max(...heights) - Math.min(...heights), `group ${index} equal heights`).toBeLessThanOrEqual(1);
      expect(Math.max(...heights), `group ${index} compact`).toBeLessThanOrEqual(48);
      expect(Math.min(...heights), `group ${index} target`).toBeGreaterThanOrEqual(36);
      await expect(groups.nth(index).locator('[aria-pressed="true"]')).toHaveCount(1);
    }

    // Short, sentence-case labels: no letter-spaced uppercase, no parenthetical theme label.
    const shouting = await dialog.evaluate(root =>
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
    expect(shouting).toBe(0);
    await expect(dialog).not.toContainText('(');
  });

  test('a live preview follows the choices and the page updates at once', DESKTOP, async ({ page }) => {
    const { dialog } = await openSettings(page);
    const preview = dialog.getByTestId('settings-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('°C');
    await expect(preview).toContainText('m/s');

    await dialog.getByRole('button', { name: /°F|Fahrenhayt|Fahrenheit/ }).click();
    await expect(preview).toContainText('°F');
    await dialog.getByRole('button', { name: 'km/h' }).click();
    await expect(preview).toContainText('km/h');
    // The page behind changes without closing or saving.
    await expect(page.locator('.hava81-decision-field')).toContainText('°F');
    await expect(dialog).toBeVisible();
  });

  test('Escape and an outside click close it and return focus to the trigger', DESKTOP, async ({ page }) => {
    const { trigger, dialog } = await openSettings(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(40, 600);
    await expect(dialog).toBeHidden();
  });

  test('settings pass axe in light and dark themes', DESKTOP, async ({ page }) => {
    for (const themeMode of ['light', 'dark'] as const) {
      await seedSettings(page, { themeMode });
      await openSettings(page);
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
          { include: [['[role="dialog"]']] },
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
      await page.keyboard.press('Escape');
    }
  });

  test('reduced motion opens it without animation', DESKTOP, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { dialog } = await openSettings(page);
    const running = await dialog.evaluate(root =>
      [root, ...Array.from(root.querySelectorAll('*'))].flatMap(element =>
        element.getAnimations().filter(animation => animation.playState === 'running')
      ).length
    );
    expect(running).toBe(0);
  });

  test('phone settings open as a bottom sheet with a handle', MOBILE, async ({ page }) => {
    const { dialog } = await openSettings(page);
    const d = await box(dialog);
    const viewport = page.viewportSize()!;
    expect(Math.abs(d.y + d.height - viewport.height), 'sheet rests on the bottom edge').toBeLessThanOrEqual(1);
    expect(d.width, 'sheet spans the width').toBeGreaterThanOrEqual(viewport.width - 24);
    expect(d.height, 'sheet leaves the page visible above').toBeLessThanOrEqual(viewport.height * 0.85);
    await expect(dialog.locator('[data-sheet-handle]')).toBeVisible();
    await expect(dialog.getByRole('group')).toHaveCount(4);
    await expectNoHorizontalScroll(page, '390px');
  });

  test('version is a quiet footnote', DESKTOP, async ({ page }) => {
    const { dialog } = await openSettings(page);
    const version = dialog.getByText(/^v\d+\.\d+\.\d+$/);
    await expect(version).toBeVisible();
    expect(
      await version.evaluate(element => parseFloat(getComputedStyle(element).fontSize))
    ).toBeLessThanOrEqual(12);
  });
});
