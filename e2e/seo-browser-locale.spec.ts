import { DESKTOP, expect, test } from './helpers/test';

/** Protect the first-visit path: browser locale must not leave stale Turkish SEO metadata. */
test.describe('browser locale and canonical metadata', () => {
  test.use({ locale: 'en-US', mockApi: false });

  test(
    'localizes a Turkish city URL and its document head before weather is available',
    DESKTOP,
    async ({ page }) => {
      await page.addInitScript(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {
          // The initial about:blank document has no origin storage.
        }
      });
      // SEO/routing must remain correct when the live provider is slow or unavailable.
      await page.route('**/api/v1/**', route => route.abort());
      await page.goto('/istanbul/');

      await expect(page).toHaveURL(/\/en\/istanbul\/$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page).toHaveTitle('İstanbul weather — Hava81');
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        /\/en\/istanbul\/$/
      );
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        'content',
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
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
        'href',
        /\/istanbul\/$/
      );
    }
  );
});
