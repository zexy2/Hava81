import { expect, type Page } from '@playwright/test';

const DEFERRED_LABEL =
  /Saatlik tahmin, bu bölüm ekrana yaklaştığında yüklenir\.|Hourly forecast loads as you approach this section\./i;

/**
 * Forecast tests must approach the reserved chart slot before asserting chart controls.
 * Wait for either the atlas itself or its deferred placeholder: a nearby slot may already
 * have crossed the observer margin while the test is waiting for its locator.
 */
export async function ensureForecastAtlasLoaded(page: Page) {
  const atlas = page.locator('.hava81-forecast-atlas').first();
  const deferred = page
    .locator('.atlas-forecast-loading--card')
    .filter({ hasText: DEFERRED_LABEL })
    .first();

  // Count the atlas root rather than checking visibility: its CSS can use a display mode
  // where Playwright reports the root as not visible even while its chart controls are rendered.
  await expect
    .poll(
      async () => {
        if (await atlas.count()) return 'loaded';
        if (await deferred.isVisible().catch(() => false)) return 'deferred';
        return 'pending';
      },
      { timeout: 15_000, message: 'forecast should become loaded or expose its deferred slot' }
    )
    .not.toBe('pending');

  if (await atlas.count()) return;

  // Approach the deferred placeholder the way a reader does: keep bringing it into view
  // until the chart mounts. A single jump can land before the observer's next frame, or be
  // undone by scroll anchoring while the page above settles, so one call is not enough.
  await expect
    .poll(
      async () => {
        if (await atlas.count()) return true;
        await page.evaluate(() =>
          document
            .querySelector('.atlas-forecast-loading--card')
            ?.scrollIntoView({ block: 'center', behavior: 'auto' })
        );
        return (await atlas.count()) > 0;
      },
      {
        timeout: 15_000,
        intervals: [100, 250, 500],
        message: 'approaching the forecast slot should mount the chart',
      }
    )
    .toBe(true);
  await expect(atlas, 'approaching the forecast slot should mount the chart').toHaveCount(1, {
    timeout: 15_000,
  });
}
