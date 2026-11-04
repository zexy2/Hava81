/**
 * Contract for the commercial-use base map: MapLibre with OpenFreeMap vector tiles.
 *
 * FROZEN: written before the implementation and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it. Tiles come from the local fixtures.
 */
import type { Page, Request } from '@playwright/test';
import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import { mockMapTiles, seedSettings } from './helpers/weather-fixtures';

test.use({ bypassCSP: true });

const surface = (page: Page) => page.locator('[data-map-surface]');

async function openMap(page: Page, path = '/istanbul/?view=map') {
  const requests: string[] = [];
  page.on('request', (request: Request) => requests.push(request.url()));
  await mockMapTiles(page);
  await page.goto(path);
  await expect(surface(page)).toBeVisible({ timeout: 15_000 });
  return requests;
}

test.describe('MapLibre + OpenFreeMap base map', () => {
  test('loads the OpenFreeMap style and reports the tiles as loaded', DESKTOP, async ({ page }) => {
    const requests = await openMap(page);

    await expect(surface(page)).toHaveAttribute('data-map-tiles', 'loaded', { timeout: 15_000 });
    await expect(surface(page)).toHaveAttribute('data-map-renderer', 'webgl');
    await expect(surface(page).locator('canvas').first()).toBeVisible();
    expect(requests.some(url => url.startsWith('https://tiles.openfreemap.org/styles/'))).toBe(
      true
    );
    // The old raster hosts are not licensed for this use and are no longer contacted.
    expect(requests.filter(url => /openstreetmap\.(fr|de)/.test(url))).toEqual([]);
    await expect(page.getByText(/Harita hazırlanıyor|Loading map tiles/i)).toBeHidden();
  });

  test('light and dark themes pick their own OpenFreeMap style', DESKTOP, async ({ page }) => {
    await seedSettings(page, { themeMode: 'dark' });
    const requests = await openMap(page);
    await expect(surface(page)).toHaveAttribute('data-map-tiles', 'loaded', { timeout: 15_000 });
    expect(requests.some(url => url.endsWith('/styles/dark'))).toBe(true);
    expect(requests.some(url => url.endsWith('/styles/positron'))).toBe(false);
  });

  test(
    'credits OpenFreeMap, OpenMapTiles and OpenStreetMap with links',
    DESKTOP,
    async ({ page }) => {
      await openMap(page);
      const credits = page.locator('.weather-map__attribution');
      await expect(credits.getByRole('link', { name: /OpenFreeMap/ })).toHaveAttribute(
        'href',
        /openfreemap\.org/
      );
      await expect(credits.getByRole('link', { name: /OpenMapTiles/ })).toHaveAttribute(
        'href',
        /openmaptiles\.org/
      );
      await expect(credits.getByRole('link', { name: /OpenStreetMap/ })).toHaveAttribute(
        'href',
        /openstreetmap\.org\/copyright/
      );
    }
  );

  test('zoom buttons change the map and are touch-sized on phones', MOBILE, async ({ page }) => {
    await openMap(page, '/izmir/?view=map');
    const zoomIn = page.getByRole('button', { name: /Yakınlaştır|Zoom in/ });
    const zoomOut = page.getByRole('button', { name: /Uzaklaştır|Zoom out/ });
    await expect(zoomIn).toBeVisible();
    for (const button of [zoomIn, zoomOut]) {
      const size = await button.boundingBox();
      expect(size?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(size?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    // Province plates appear once the map is zoomed to atlas scale.
    const plates = page.locator('.weather-map__plate-marker');
    const before = await plates.count();
    for (let step = 0; step < 3; step += 1) {
      await zoomIn.click();
      await page.waitForTimeout(350);
    }
    await expect.poll(() => plates.count(), { timeout: 5_000 }).toBeGreaterThan(before);
  });

  test('a marker popup opens, closes on Escape and by its button', DESKTOP, async ({ page }) => {
    await openMap(page);
    await page.locator('.weather-map__marker').first().click();
    const popup = page.locator('[data-map-popup]');
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    await page.locator('.weather-map__marker').first().click();
    await expect(popup).toBeVisible();
    await popup.getByRole('button', { name: /Kapat|Close/ }).click();
    await expect(popup).toHaveCount(0);
  });

  test(
    'without WebGL the page stays up and says the map is unavailable',
    DESKTOP,
    async ({ page }) => {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          type: string,
          ...rest: unknown[]
        ) {
          if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
          return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
        } as typeof HTMLCanvasElement.prototype.getContext;
      });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await openMap(page);

      await expect(surface(page)).toHaveAttribute('data-map-renderer', 'none');
      await expect(page.getByRole('alert')).toContainText(/Harita yüklenemedi|could not load/i);
      await expect(
        page.getByRole('heading', { name: /Türkiye hava atlası|Turkey weather atlas/i })
      ).toBeVisible();
      expect(errors).toEqual([]);
    }
  );
});
