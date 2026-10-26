import { expect, test } from './helpers/test';
import { fixtures, mockNewEndpointsMissing, seedSettings } from './helpers/weather-fixtures';

test('cached weather clearly reports offline state in both locales and clears on reconnect', async ({ page }) => {
  await mockNewEndpointsMissing(page);
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: fixtures.current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: fixtures.forecast }));
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: fixtures.hourlyForecast }));

  const locales = [
    {
      language: 'tr',
      message: 'Çevrimdışısın. Son alınan hava verileri gösteriliyor; bağlantı gelince yenilenecek.',
    },
    {
      language: 'en',
      message: "You're offline. Showing the last available weather; it will refresh when you're back online.",
    },
  ] as const;

  for (const locale of locales) {
    await seedSettings(page, { language: locale.language });
    await page.goto('/istanbul/');
    await expect(page.locator('.hava81-decision-field__temperature')).toBeVisible();

    const notice = page.locator('.atlas-message--offline');
    await expect(notice).toHaveCount(0);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
      window.dispatchEvent(new Event('offline'));
    });
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('role', 'status');
    await expect(notice).toHaveAttribute('aria-live', 'polite');
    await expect(notice).toContainText(locale.message);
    await expect(page.locator('.hava81-decision-field__temperature')).toBeVisible();

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
      window.dispatchEvent(new Event('online'));
    });
    await expect(notice).toHaveCount(0);
  }
});
