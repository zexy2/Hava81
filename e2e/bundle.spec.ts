import { MOBILE, DESKTOP, expect, test } from './helpers/test';
import { setWidth } from './helpers/layout';
import {
  fixtures,
  mockBundleApi,
  mockMapTiles,
  mockProvincesApi,
  overrideApiJson,
} from './helpers/weather-fixtures';

// Faz 3.2: tek `/weather/bundle` isteği, eski API'ye geri düşüş ve 81 ilin canlı sıcaklığı.

const SINGLE_ENDPOINTS = ['/weather/forecast', '/weather/air-quality', '/weather/context'];

test.describe('weather bundle', () => {
  test(
    'loads forecast and optional evidence through one bundle request',
    DESKTOP,
    async ({ page }) => {
      await mockBundleApi(page);
      // Tekil uç noktalar kullanılırsa sayfa hata kartı gösterir: bundle yolu gerçekten kullanılmalı.
      await overrideApiJson(page, 'forecast', { error: 'single endpoint used' }, 400);
      await overrideApiJson(page, 'air', { error: 'single endpoint used' }, 400);
      await overrideApiJson(page, 'context', { error: 'single endpoint used' }, 400);
      const bundleRequests: string[] = [];
      const singleRequests: string[] = [];
      page.on('request', request => {
        const { pathname } = new URL(request.url());
        if (pathname.endsWith('/weather/bundle')) bundleRequests.push(request.url());
        if (SINGLE_ENDPOINTS.some(endpoint => pathname.endsWith(endpoint))) {
          singleRequests.push(pathname);
        }
      });

      await page.goto('/istanbul/');

      await expect(page.locator('.hava81-forecast-atlas').first()).toBeVisible();
      await expect(page.locator('.atlas-forecast-error-card')).toHaveCount(0);
      expect(bundleRequests).toHaveLength(1);
      expect(singleRequests).toEqual([]);
    }
  );

  test(
    'keeps today and plan working with the five-day (120 h) hourly payload (plan v3 P1.1)',
    DESKTOP,
    async ({ page }) => {
      await mockBundleApi(page, { ...fixtures, hourlyForecast: fixtures.hourlyForecast120() });

      await page.goto('/istanbul/');
      await expect(page.locator('.hava81-forecast-atlas').first()).toBeVisible();
      await expect(page.locator('.atlas-forecast-error-card')).toHaveCount(0);

      await page.goto('/istanbul/?view=plan');
      await expect(page.locator('.atlas-plan-view')).toBeVisible();
      await expect(page.locator('.atlas-forecast-error-card')).toHaveCount(0);
    }
  );

  test(
    'falls back to the single endpoints when the API has no bundle yet',
    DESKTOP,
    async ({ page }) => {
      // Varsayılan mock: bundle 404 (bugünkü canlı API).
      const singleRequests: string[] = [];
      page.on('request', request => {
        const { pathname } = new URL(request.url());
        if (SINGLE_ENDPOINTS.some(endpoint => pathname.endsWith(endpoint))) {
          singleRequests.push(pathname);
        }
      });

      await page.goto('/istanbul/');

      await expect(page.locator('.hava81-forecast-atlas').first()).toBeVisible();
      await expect(page.locator('.atlas-forecast-error-card')).toHaveCount(0);
      await expect.poll(() => singleRequests.length).toBeGreaterThanOrEqual(3);
    }
  );
});

test.describe('map live province temperatures', () => {
  test('zoomed atlas shows live temperatures next to plates', MOBILE, async ({ page }) => {
    await mockMapTiles(page);
    await mockProvincesApi(page, [
      { plate: 16, name: 'Bursa', lat: 40.19, lon: 29.06, temperature: 17.6 },
      { plate: 41, name: 'Kocaeli', lat: 40.77, lon: 29.94, temperature: 15.2 },
    ]);
    await setWidth(page, 390, 844);
    await page.goto('/istanbul/?view=map');

    const bursa = page.locator('.weather-map__plate-marker').filter({ hasText: '16' });
    await expect(bursa).toBeVisible();
    await expect(bursa.locator('.weather-map__plate-temp')).toHaveText('18°');
    await expect(bursa).toHaveAttribute('aria-label', /Bursa: .*18°C/);
    // Plaka numarası sıcaklıkla aynı öğede değil.
    await expect(bursa.locator('span')).not.toContainText('°');
    await expect(page.locator('.weather-map__attribution')).toContainText(
      '81 ilin anlık sıcaklığı'
    );
  });

  test(
    'map keeps plate-only markers when the provinces endpoint is missing',
    MOBILE,
    async ({ page }) => {
      await mockMapTiles(page);
      await setWidth(page, 390, 844);
      await page.goto('/istanbul/?view=map');

      const bursa = page.locator('.weather-map__plate-marker').filter({ hasText: '16' });
      await expect(bursa).toBeVisible();
      await expect(page.locator('.weather-map__plate-temp')).toHaveCount(0);
    }
  );
});
