import { DESKTOP, expect, test } from './helpers/test';

/** Faz 4: English edition under /en/<il>/ with hreflang, and the real 404 view. */
test.describe('English edition and 404', () => {
  test(
    'an /en/<il>/ address opens the province in English and keeps the English URL',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/en/istanbul/');
      await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page).toHaveURL(/\/en\/istanbul\/$/);
      await expect(page).toHaveTitle('İstanbul weather — Hava81');
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        /\/en\/istanbul\/$/
      );
      await expect(page.locator('link[rel="alternate"][hreflang="tr"]')).toHaveAttribute(
        'href',
        /\/istanbul\/$/
      );
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
        'href',
        /\/en\/istanbul\/$/
      );
      await expect(page.locator('[data-static-summary]')).toHaveCount(0);
    }
  );

  test(
    'keeps city URL and canonical metadata locale-correct when weather is unavailable',
    DESKTOP,
    async ({ page }) => {
      await page.addInitScript(() => {
        try {
          const current = JSON.parse(localStorage.getItem('user-settings') ?? '{}');
          localStorage.setItem(
            'user-settings',
            JSON.stringify({
              ...current,
              language: 'en',
              temperatureUnit: 'metric',
              windSpeedUnit: 'ms',
              themeMode: 'auto',
            })
          );
        } catch {
          // The first about:blank document has no localStorage origin.
        }
      });
      await page.route('**/api/v1/**', route => route.abort());
      await page.goto('/istanbul/');

      await expect(page).toHaveURL(/\/en\/istanbul\/$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page).toHaveTitle('İstanbul weather — Hava81');
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        /\/en\/istanbul\/$/
      );
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        /Current weather, hourly and daily forecast/
      );
    }
  );

  test(
    'an unknown address shows "Bu adreste bir il yok" with province suggestions',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/istanbl/');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Bu adreste bir il yok' })
      ).toBeVisible();
      const suggestions = page.getByRole('navigation', { name: 'Şunu mu arıyordun?' });
      await expect(suggestions.getByRole('link').first()).toHaveText('İstanbul');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
      await suggestions.getByRole('link', { name: 'İstanbul' }).click();
      await expect(page).toHaveURL(/\/istanbul\/$/);
      await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
    }
  );
});
