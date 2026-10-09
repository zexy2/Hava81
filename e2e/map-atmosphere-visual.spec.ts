import { test, expect } from '@playwright/test';

/**
 * The unloaded Leaflet tile region should never look like a broken gray box.
 * Decorative contours are not geographic data and must remain underneath
 * real raster tiles (and must not intercept map pointer events).
 */
// Deterministic API fixtures make this visual contract independent of
// real weather-provider keys, external latency, and the selected CI host.
const now = new Date().toISOString();
const current = {
  cityName: 'İzmir', country: 'TR', temperature: 22, feelsLike: 21,
  tempMin: 17, tempMax: 25, humidity: 58, pressure: 1012, visibility: 10000,
  windSpeed: 4.2, windDirection: 180, description: 'açık', icon: '01d',
  sunrise: new Date(Date.now() - 6 * 3600_000).toISOString(),
  sunset: new Date(Date.now() + 6 * 3600_000).toISOString(),
  timestamp: now, coordinates: { lat: 38.42, lon: 27.14 }, clouds: 5,
  meta: { provider: 'OpenWeather', fetchedAt: now, timezoneOffsetSeconds: 10800,
    cacheStatus: 'MISS', freshForSeconds: 300 },
};
const forecast = {
  daily: [{ date: now.slice(0, 10), tempMin: 17, tempMax: 25,
    icon: '01d', description: 'açık', pop: 10 }],
  hourly: [{ time: new Date(Date.now() + 3600_000).toISOString(), temp: 22,
    icon: '01d', description: 'açık', pop: 10, windSpeed: 4 }],
  meta: { provider: 'OpenWeather', fetchedAt: now, timezoneOffsetSeconds: 10800,
    intervalHours: 3, cacheStatus: 'MISS', freshForSeconds: 300 },
};
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({
    json: { aqi: 2, aqiLabel: 'Orta', pm25: 9, pm10: 14, o3: 42,
      meta: { provider: 'OpenWeather', fetchedAt: now, cacheStatus: 'MISS', freshForSeconds: 300 } },
  }));
  await page.route('**/api/v1/weather/context**', route => route.fulfill({
    json: { provider: 'Open-Meteo', fetchedAt: now, attribution: 'Open-Meteo',
      uvIndexMax: 5, dustMax: 2, grassPollenMax: 1, olivePollenMax: 0 },
  }));
});

for (const width of [390, 1280]) {
  test(`map tile loading shows a branded fallback without blocking the map at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });

    let releaseTiles: (() => void) | undefined;
    const tileGate = new Promise<void>(resolve => { releaseTiles = resolve; });
    const tile = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
      'base64'
    );
    let waitingRequests = 0;
    await page.route('**/hot/**', async route => {
      waitingRequests += 1;
      await tileGate;
      await route.fulfill({ status: 200, contentType: 'image/png', body: tile }).catch(() => {});
    });

    try {
      await page.goto('/izmir/');
      if (width === 390) {
        await page.locator('.atlas-bottom-nav').getByRole('button', { name: 'Harita' }).click();
      } else {
        await page.locator('.atlas-icon-button--map').first().click();
      }
      const container = page.locator('.weather-map__container');
      const loading = container.locator('.weather-map__tile-status');
      await expect.poll(() => waitingRequests).toBeGreaterThan(0);
      await expect(loading).toBeVisible();

      const visual = await container.evaluate(el => {
        const base = getComputedStyle(el);
        const leaflet = el.querySelector('.weather-map__leaflet')!;
        const surface = getComputedStyle(leaflet);
        const art = getComputedStyle(el, '::before');
        const status = el.querySelector('.weather-map__tile-status')!;
        const statusStyle = getComputedStyle(status);
        const parent = el.getBoundingClientRect();
        const badge = status.getBoundingClientRect();
        return {
          decorated: base.backgroundImage.includes('gradient'),
          leafletTransparent: surface.backgroundColor === 'rgba(0, 0, 0, 0)',
          artNonblocking: art.pointerEvents === 'none',
          statusNonblocking: statusStyle.pointerEvents === 'none',
          badgeInside: badge.left >= parent.left && badge.right <= parent.right + 1 &&
            badge.bottom <= parent.bottom + 1,
          overflow: document.documentElement.scrollWidth > innerWidth,
          badgeBorder: Number.parseFloat(statusStyle.borderLeftWidth),
        };
      });
      expect(visual).toMatchObject({
        decorated: true,
        leafletTransparent: true,
        artNonblocking: true,
        statusNonblocking: true,
        badgeInside: true,
        overflow: false,
      });
      expect(visual.badgeBorder).toBeGreaterThanOrEqual(4);

      // Zoom actions remain usable even while the map backdrop is shown.
      await expect(container.locator('.leaflet-control-zoom-in')).toBeVisible();
    } finally {
      releaseTiles?.();
    }
    await expect(page.locator('.weather-map__tile-status')).toBeHidden({ timeout: 15000 });
    await expect.poll(() => page.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0);
  });
}

test('failed map tile providers leave a readable, interactive retry card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/hot/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.route('**/tiles/osmde/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/izmir/');
  await page.locator('.atlas-bottom-nav').getByRole('button', { name: 'Harita' }).click();

  const state = page.locator('.weather-map__tile-status--failed');
  await expect(state).toBeVisible({ timeout: 15000 });
  const retry = state.getByRole('button', { name: 'Tekrar dene' });
  await expect(retry).toBeVisible();
  await expect(retry).toBeEnabled();
  const info = await state.evaluate(el => {
    const css = getComputedStyle(el);
    const retry = el.querySelector('button')!.getBoundingClientRect();
    return {
      interactive: css.pointerEvents === 'auto',
      retryTall: retry.height >= 44,
      readable: css.color !== css.backgroundColor,
      noOverflow: document.documentElement.scrollWidth <= innerWidth,
    };
  });
  expect(info).toEqual({ interactive: true, retryTall: true, readable: true, noOverflow: true });
});
