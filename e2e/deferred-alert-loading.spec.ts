import { DESKTOP, expect, test } from './helpers/test';

test(
  'notification logic is not requested until the alert slot approaches the viewport',
  DESKTOP,
  async ({ page }) => {
    const requestedChunks: string[] = [];
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (/\/assets\/DecisionAlertsPanel-[^/]+\.js$/.test(path)) {
        requestedChunks.push(path);
      }
    });

    // Use the phone viewport even in the desktop project so the alert slot is
    // reliably well below the initial fold while the Plan view is fully rendered.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/izmir/?view=plan');
    await expect(page.locator('.atlas-plan-view__header h1')).toBeVisible();

    const slot = page.locator('.atlas-deferred-alerts-slot');
    await expect(slot).toBeVisible();
    const top = await slot.evaluate(element => element.getBoundingClientRect().top);
    expect(top).toBeGreaterThan(844 + 320);
    await expect.poll(() => requestedChunks.length).toBe(0);

    // Approaching the reserved slot activates the real panel; only then should
    // its notification/freshness code be downloaded and mounted.
    await slot.scrollIntoViewIfNeeded();
    await expect(page.locator('.decision-alerts')).toBeVisible();
    await expect.poll(() => requestedChunks.length).toBeGreaterThan(0);
  }
);
