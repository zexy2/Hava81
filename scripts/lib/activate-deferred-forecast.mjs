const forecastSelector = '.hava81-forecast-atlas, .atlas-forecast-error-card';
const forecastStateSelector = forecastSelector + ', .atlas-forecast-loading--card';
const deferredCopy = /Saatlik tahmin, bu bölüm ekrana yaklaştığında yüklenir\.|Hourly forecast loads as you approach this section\./i;

/**
 * Activate the deliberately deferred hourly forecast before measuring or capturing a page.
 * The helper is shared by the live responsive audit and screenshot audit so a placeholder
 * cannot be mistaken for a missing chart on narrow mobile viewports.
 */
export async function activateDeferredForecast(page, { timeout = 15_000, scrollTimeout = 1_000 } = {}) {
  const forecastContent = page.locator(forecastSelector).first();
  const deferredForecast = page
    .locator('.atlas-forecast-loading--card')
    .filter({ hasText: deferredCopy })
    .first();

  await page.locator(forecastStateSelector).first().waitFor({ state: 'visible', timeout });

  if (!(await forecastContent.count()) && await deferredForecast.isVisible().catch(() => false)) {
    try {
      await deferredForecast.evaluate(
        element => element.scrollIntoView({ block: 'center', behavior: 'auto' }),
        undefined,
        { timeout: scrollTimeout },
      );
    } catch (error) {
      // IntersectionObserver can replace the placeholder between visibility and scroll.
      // Ignore only that detach race; preserve a real scroll failure while it remains visible.
      if (await deferredForecast.isVisible().catch(() => false)) throw error;
    }
  }

  await forecastContent.waitFor({ state: 'visible', timeout });
  return forecastContent;
}

/** Return to the actual first viewport after activation, then allow layout to settle. */
export async function restoreViewportTop(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
