import { expect, type Page } from '@playwright/test';

const DEFERRED_LABEL = /Saatlik tahmin, bu bölüm ekrana yaklaştığında yüklenir\.|Hourly forecast loads as you approach this section\./i;

/**
 * Forecast tests must approach the reserved chart slot before asserting chart controls.
 * Wait for either the atlas itself or its deferred placeholder: a nearby slot may already
 * have crossed the observer margin while the test is waiting for its locator.
 */
export async function ensureForecastAtlasLoaded(page: Page) {
  const atlas = page.locator('.hava81-forecast-atlas').first();
  const deferred = page.locator('.atlas-forecast-loading--card').filter({ hasText: DEFERRED_LABEL }).first();

  // Count the atlas root rather than checking visibility: its CSS can use a display mode
  // where Playwright reports the root as not visible even while its chart controls are rendered.
  await expect.poll(
    async () => {
      if (await atlas.count()) return 'loaded';
      if (await deferred.isVisible().catch(() => false)) return 'deferred';
      return 'pending';
    },
    { timeout: 15_000, message: 'forecast should become loaded or expose its deferred slot' }
  ).not.toBe('pending');

  if (await atlas.count()) return;

  // Directly approach the deferred placeholder after the observer is installed. The observer
  // may replace it as soon as the scroll reaches its 120px activation margin.
  try {
    // The observer can replace the placeholder between isVisible() and this call.
    // Bound the locator wait so a detached placeholder cannot consume the whole test timeout.
    await deferred.evaluate(
      element => element.scrollIntoView({ block: 'center', behavior: 'auto' }),
      undefined,
      { timeout: 1_000 }
    );
  } catch {
    // The placeholder was swapped out mid-call: the chart is mounting, so wait for it below
    // instead of failing on the race.
  }
  await expect(atlas, 'approaching the forecast slot should mount the chart').toHaveCount(1, {
    timeout: 15_000,
  });
}
