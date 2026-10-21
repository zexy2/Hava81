import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import {
  expectContainedIn,
  expectReachable,
  expectReadable,
  setTextScale,
  setWidth,
} from './helpers/layout';

// Settings dialog (Ayarlar). Absorbs the former e2e/settings-resize.spec.ts.

const openSettings = async (page: import('@playwright/test').Page) => {
  await page.locator('.atlas-settings-button').click();
  const dialog = page.getByRole('dialog', { name: /ayarlar|settings/i });
  await expect(dialog).toBeVisible();
  return dialog;
};

test.describe('settings dialog', () => {
  test('settings dialog avoids nested page landmarks', MOBILE, async ({ page }) => {
    await page.goto('/istanbul');
    await page.locator('.atlas-settings-button').click();

    const dialog = page.getByRole('dialog', { name: /ayarlar|settings/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('banner')).toHaveCount(0);
    await expect(dialog.getByRole('contentinfo')).toHaveCount(0);
  });

  test(
    'short landscape settings keeps header and footer on screen and scrolls its content at 200% text',
    DESKTOP,
    async ({ page }) => {
      await setWidth(page, 568, 320);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/istanbul');
      const dialog = await openSettings(page);
      const content = dialog.locator('.settings-panel__content');
      const footer = dialog.locator('.settings-panel__footer');
      const close = dialog.locator('.settings-panel__close');

      for (const scale of [100, 200] as const) {
        await setTextScale(page, scale);
        const at = `${scale}%`;
        await expect(footer, `footer on screen ${at}`).toBeInViewport({ ratio: 1 });
        await expect(close, `close on screen ${at}`).toBeInViewport({ ratio: 1 });
        // The dialog does not scroll as a whole; its content area does.
        expect(
          await dialog.evaluate(element => element.scrollHeight <= element.clientHeight + 1),
          `dialog fits ${at}`
        ).toBe(true);
        expect(
          await content.evaluate(element => element.scrollHeight > element.clientHeight),
          `content scrolls ${at}`
        ).toBe(true);
        await content.evaluate(element => {
          element.scrollTop = element.scrollHeight;
        });
        expect(
          await content.evaluate(element => element.scrollTop),
          `content scroll moves ${at}`
        ).toBeGreaterThan(0);
        expect(
          await dialog.evaluate(element => element.contains(document.activeElement)),
          `focus stays in dialog ${at}`
        ).toBe(true);
      }
    }
  );

  test('phone settings reflow every option group at 200% text', MOBILE, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/istanbul');
    await setTextScale(page, 200);
    const dialog = await openSettings(page);
    for (const width of [390, 320]) {
      await setWidth(page, width, 844);
      const at = `${width}px/200%`;
      await expectReadable(page, dialog, at);
      for (const option of await dialog.locator('.settings-option').all())
        await expectContainedIn(option, dialog, `option ${at}`, 'x');
      await expectReachable(dialog.locator('.settings-panel__close'), `close ${at}`);
    }
    // Options still work at this size.
    await dialog.getByRole('button', { name: 'Koyu' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
  });
});
