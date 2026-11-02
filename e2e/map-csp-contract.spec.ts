/**
 * Contract for the batch-4 browser checks of the MapLibre base map (PR #1743).
 * Each test names the issue it closes.
 *
 * This file deliberately does NOT bypass the Content-Security-Policy: the built site's CSP
 * meta tag is enforced, so a blocked worker, style, tile or `data:` image fails here.
 * Tile hosts are served from local fixtures at their real URLs, so CSP sees the real origins.
 *
 * FROZEN: written before the implementation and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it.
 */
import type { ConsoleMessage, Page } from '@playwright/test';
import { DESKTOP, expect, test } from './helpers/test';
import { TURKISH_CITIES } from '../src/constants/cities';
import { mockMapTiles, mockProvincesApi } from './helpers/weather-fixtures';

test.use({ bypassCSP: false });

const surface = (page: Page) => page.locator('[data-map-surface]');

// All 81 provinces with a temperature, so the temperature field has full coverage to draw.
const ALL_PROVINCES = TURKISH_CITIES.map(city => ({
  plate: city.plateCode,
  name: city.name,
  lat: city.coordinates.lat,
  lon: city.coordinates.lon,
  temperature: 12 + (city.plateCode % 9),
}));

/** Weather and bundle mocks are installed by the shared fixture (`mockApi`). */
async function openMap(page: Page) {
  await mockProvincesApi(page, ALL_PROVINCES);
  await mockMapTiles(page);
  await page.goto('/istanbul/?view=map');
}

const watchCsp = (page: Page) => {
  const violations: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    const text = message.text();
    if (/Content Security Policy|Refused to (load|connect|create|execute)|CSP/i.test(text))
      violations.push(text);
  });
  page.on('pageerror', error => {
    if (/worker|Content Security Policy/i.test(error.message)) violations.push(error.message);
  });
  return violations;
};

test.describe('MapLibre under the production CSP', () => {
  // #1756
  test(
    '#1756 the map, its worker, tiles and weather field load with the CSP enforced',
    DESKTOP,
    async ({ page }) => {
      const violations = watchCsp(page);
      await openMap(page);

      // The CSP meta tag is really there: this run is not bypassing it.
      await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
      await expect(surface(page)).toHaveAttribute('data-map-tiles', 'loaded', { timeout: 20_000 });
      await expect(surface(page)).toHaveAttribute('data-map-renderer', 'webgl');
      // The fixture has temperatures for all 81 provinces; that layer draws a full field.
      await page.getByRole('button', { name: 'Sıcaklık' }).click();
      // The weather field is a `data:` image read through MapLibre's image source.
      await expect(surface(page)).toHaveAttribute('data-map-field', 'loaded', { timeout: 20_000 });
      expect(violations).toEqual([]);
    }
  );

  // #1755
  test('#1755 every map popup is a named dialog', DESKTOP, async ({ page }) => {
    await openMap(page);
    await expect(surface(page)).toHaveAttribute('data-map-tiles', 'loaded', { timeout: 20_000 });

    await page.locator('[data-map-marker]').first().click();
    const dialog = page.locator('[data-map-popup][role="dialog"]');
    await expect(dialog).toHaveCount(1);
    const labelledBy = await dialog.getAttribute('aria-labelledby');
    const label = await dialog.getAttribute('aria-label');
    const name = labelledBy
      ? ((await page.locator(`[id="${labelledBy}"]`).textContent()) ?? '').trim()
      : (label ?? '').trim();
    expect(name.length).toBeGreaterThan(0);
  });
});
