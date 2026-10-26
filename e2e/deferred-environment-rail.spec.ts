import { expect, test, DESKTOP } from './helpers/test';

test(
  'deferred environment rail reserves its responsive footprint before activation',
  DESKTOP,
  async ({ page }) => {
    const viewports = [
      { width: 320, minHeight: 416 },
      { width: 390, minHeight: 224 },
      { width: 768, minHeight: 224 },
      { width: 1440, minHeight: 128 },
    ] as const;

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: 480 });
      await page.goto('/izmir/');

      const slot = page.locator('.atlas-deferred-environment-slot');
      await expect(slot).toHaveAttribute('aria-busy', 'true');
      const box = await slot.boundingBox();

      expect(
        box?.height ?? 0,
        'viewport ' + viewport.width + 'px must reserve the environment rail before it enters view'
      ).toBeGreaterThanOrEqual(viewport.minHeight);
    }
  }
);
