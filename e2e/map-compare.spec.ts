import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import {
  expectContainedIn,
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectReachable,
  expectReadable,
  expectTextNotClipped,
  expectTouchTarget,
  expectVisibleFocusRing,
  expectWithinViewportWidth,
  findUndersizedTargets,
  setTextScale,
  setWidth,
} from './helpers/layout';
import {
  TILE_PNG,
  TWO_FAVORITES,
  fixtures,
  mockMapTiles,
  overrideApi,
  seedFavorites,
  seedSettings,
} from './helpers/weather-fixtures';

const { current } = fixtures;

// Harita (`?view=map`), Karşılaştır (`?view=compare`) and the saved-city tab rail.

test.describe('map view', () => {
  test('keyboard map close restores focus to the map trigger', MOBILE, async ({ page }) => {
    await page.goto('/istanbul');

    const mapTrigger = page.locator('.atlas-bottom-nav__button').filter({ hasText: 'Harita' });
    await expect(mapTrigger).toBeVisible();
    await mapTrigger.focus();
    await page.keyboard.press('Enter');

    const mapRegion = page.locator('#weather-map-region');
    const bottomNav = page.locator('.atlas-bottom-nav');
    await expect(mapRegion).toBeVisible();
    await expect(mapRegion).toBeFocused();
    await expect(bottomNav).toBeHidden();

    await setTextScale(page, 200);

    const zoomIn = mapRegion.locator('.leaflet-control-zoom-in');
    const attribution = mapRegion.locator('.weather-map__attribution a').first();
    await expect(zoomIn).toBeVisible();
    await expect(attribution).toBeVisible();

    // Enlarged controls stay hit-testable when keyboard focus scrolls them into view.
    for (const control of [zoomIn, attribution]) {
      await control.focus();
      await expectReachable(control, 'map control');
    }

    const close = mapRegion.getByRole('button', { name: 'Kapat' });
    await close.focus();
    await page.keyboard.press('Enter');

    await expect(mapRegion).toBeHidden();
    await expect(bottomNav).toBeVisible();
    await expect(mapTrigger).toBeFocused();
  });

  test(
    'mobile map navigation opens a dedicated, touch-friendly map view',
    MOBILE,
    async ({ page }) => {
      await mockMapTiles(page);
      await page.goto('/istanbul');
      await page.getByRole('button', { name: 'Harita' }).click();

      const map = page.locator('#weather-map-region');
      await expect(map).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: /harita/i })).toBeVisible();
      await expect(page.getByText(/yakınlaştırarak 81 ilin tüm işaretlerini gör/i)).toBeVisible();
      await expect(page).toHaveURL(/\?view=map$/);
      await expect(page.locator('.atlas-dashboard__primary')).toBeHidden();
      await expect(page.locator('.daily-plan')).toBeHidden();
      await expect(page.locator('.app')).toHaveAttribute('data-active-nav', 'map');
      await expect(page.locator('.atlas-bottom-nav')).toBeHidden();
      await expect(map).toBeInViewport();
      await expectWithinViewportWidth(map, 'map');
      await expectNoHorizontalScroll(page);

      await expect(page.locator('.leaflet-control-zoom-in')).toBeVisible();
      expect(
        await page.locator('.weather-map__marker, .weather-map__plate-marker').count()
      ).toBeGreaterThanOrEqual(3);
      expect(
        await findUndersizedTargets(map),
        'map controls, attribution and markers are 44px targets'
      ).toEqual([]);
      await expect(page.locator('.leaflet-control-attribution')).toHaveCount(0);
      const attribution = page.locator('.weather-map__attribution');
      await expect(attribution).toContainText('OpenStreetMap contributors');
      await expect(attribution).toContainText(/OpenStreetMap France|OpenStreetMap Deutschland/);

      await page.locator('.weather-map__marker').click();
      const popupClose = page.locator('.leaflet-popup-close-button');
      await expect(popupClose).toBeVisible();
      await expectTouchTarget(popupClose, 'popup close');
      await expectNoOverlap(
        popupClose,
        page.locator('.weather-map__popup-content h4'),
        'popup close vs heading'
      );
    }
  );

  test(
    'map and compare views can be opened and left through the URL',
    DESKTOP,
    async ({ page }) => {
      await mockMapTiles(page);
      await seedFavorites(page, TWO_FAVORITES);
      await page.goto('/istanbul/?view=map');
      const map = page.locator('#weather-map-region');
      await expect(map).toBeVisible();
      await expect(page.locator('.atlas-icon-button--map')).toHaveAttribute(
        'aria-expanded',
        'true'
      );
      await map.getByRole('button', { name: 'Kapat' }).click();
      await expect(map).toBeHidden();
      await expect(page).not.toHaveURL(/view=/);

      await page.goto('/istanbul/?view=compare');
      await expect(page.getByRole('heading', { name: /Şehir karşılaştırması/i })).toBeVisible();
      await expect(page.locator('.atlas-compare-button')).toHaveAttribute('aria-current', 'page');
      await expect(page).toHaveURL(/\?view=compare$/);
    }
  );

  test(
    'mobile map header reflows at 200% text and keeps Close reachable',
    MOBILE,
    async ({ page }) => {
      await mockMapTiles(page);
      await page.goto('/istanbul');
      await setTextScale(page, 200);
      await setWidth(page, 320, 844);
      await page.getByRole('button', { name: 'Harita', exact: true }).click();
      await expect(page.locator('#weather-map-region')).toBeVisible();
      const header = page.locator('.atlas-map-panel__header');
      await expectReadable(page, header, 'map header at 320px/200%');
      await expectReachable(header.getByRole('button', { name: 'Kapat' }), 'close');
    }
  );

  test(
    'mobile map province marker previews the city before switching views',
    MOBILE,
    async ({ page }) => {
      await setWidth(page, 320, 720);
      await page.goto('/istanbul');
      await page.getByRole('button', { name: 'Harita' }).click();

      const bursaMarker = page.locator('.weather-map__plate-marker').filter({ hasText: '16' });
      await expect(bursaMarker).toBeVisible();
      await expectContainedIn(
        bursaMarker,
        page.locator('.weather-map__container'),
        'Bursa plate marker'
      );
      await expectTextNotClipped(bursaMarker, 'plate number');
      await bursaMarker.click();

      await expect(page).toHaveURL(/\/istanbul\/?\?view=map$/);
      await expect(page.locator('#weather-map-region')).toBeVisible();
      await expect(page.locator('.atlas-icon-button--map')).toHaveAttribute(
        'aria-expanded',
        'true'
      );
      await expect(page.locator('.atlas-icon-button--map')).not.toHaveAttribute('aria-pressed');
      const popup = page.locator('.weather-map__popup');
      await expect(popup.getByRole('heading', { name: 'Bursa' })).toBeVisible();
      const cityButton = popup.getByRole('button', { name: /şehrin havasını gör/i });
      await expect(cityButton).toBeVisible();

      const bursaWeatherRequest = page.waitForRequest(request => {
        const url = new URL(request.url());
        return (
          url.pathname.endsWith('/api/v1/weather/current') &&
          url.searchParams.get('city') === 'Bursa'
        );
      });
      await cityButton.click();
      await expect(bursaWeatherRequest).resolves.toBeTruthy();
      await expect(page.locator('#weather-map-region')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Bugün' })).toHaveAttribute(
        'aria-current',
        'page'
      );
    }
  );

  test(
    'mobile map announces delayed tiles and removes loading badge after display',
    MOBILE,
    async ({ page }) => {
      let releaseTiles: (() => void) | undefined;
      const tileGate = new Promise<void>(resolve => {
        releaseTiles = resolve;
      });
      let intercepted = 0;
      await page.route('**/hot/**', async route => {
        intercepted += 1;
        await tileGate;
        await route
          .fulfill({ status: 200, contentType: 'image/png', body: TILE_PNG })
          .catch(() => {});
      });

      try {
        await page.goto('/istanbul/');
        await page.locator('.atlas-bottom-nav').getByRole('button', { name: 'Harita' }).click();
        const loading = page.locator('.weather-map__tile-status');
        await expect.poll(() => intercepted).toBeGreaterThan(0);
        await expect(loading).toBeVisible();
        await expect(loading).toContainText('Harita hazırlanıyor');
        expect(await loading.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
        await expectContainedIn(
          loading,
          page.locator('.weather-map__container'),
          'tile status badge'
        );
        await expectNoHorizontalScroll(page);
      } finally {
        releaseTiles?.();
      }
      await expect(page.locator('.weather-map__tile-status')).toBeHidden({ timeout: 15_000 });
      await expect.poll(() => page.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0);
    }
  );

  test(
    'map tile loading switches to backup tiles if the primary host fails',
    MOBILE,
    async ({ page }) => {
      let backupRequests = 0;
      await page.route('**/hot/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
      await page.route('**/tiles/osmde/**', route => {
        backupRequests += 1;
        return route.fulfill({ status: 200, contentType: 'image/png', body: TILE_PNG });
      });
      await page.goto('/istanbul/');
      await page.locator('.atlas-bottom-nav').getByRole('button', { name: 'Harita' }).click();
      await expect.poll(() => backupRequests).toBeGreaterThan(0);
      await expect(page.locator('.weather-map__tile-status')).toBeHidden({ timeout: 15_000 });
      await expect(page.locator('.weather-map__attribution')).toContainText(
        'OpenStreetMap Deutschland'
      );
      await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
    }
  );

  test('map reports dual provider failure and retry recovers tiles', MOBILE, async ({ page }) => {
    let firstHostIsDown = true;
    let backupFailures = 0;
    await page.route('**/hot/**', route =>
      firstHostIsDown
        ? route.fulfill({ status: 503, body: 'Primary unavailable' })
        : route.fulfill({ status: 200, contentType: 'image/png', body: TILE_PNG })
    );
    await page.route('**/tiles/osmde/**', route => {
      backupFailures += 1;
      return route.fulfill({ status: 503, body: 'Secondary unavailable' });
    });

    await page.goto('/istanbul/');
    await page.locator('.atlas-bottom-nav').getByRole('button', { name: 'Harita' }).click();
    await expect.poll(() => backupFailures).toBeGreaterThan(0);

    const failed = page.locator('.weather-map__tile-status--failed');
    await expect(failed).toBeVisible();
    await expect(failed).toHaveAttribute('role', 'alert');
    await expect(failed).toHaveAttribute('aria-live', 'assertive');
    await expect(failed).toContainText('Harita yüklenemedi');
    const retry = failed.getByRole('button', { name: 'Tekrar dene' });
    await expect(retry).toBeEnabled();
    await expectTouchTarget(retry, 'retry');
    await expectNoHorizontalScroll(page);
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();

    firstHostIsDown = false;
    await retry.click();
    await expect(page.locator('.weather-map__tile-status')).toBeHidden({ timeout: 15_000 });
    await expect.poll(() => page.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0);
    await expect(page.locator('.weather-map__attribution')).toContainText('OpenStreetMap France');
  });
});

test.describe('compare view', () => {
  test(
    'comparison empty state explains how to compare and returns to weather',
    MOBILE,
    async ({ page }) => {
      await page.goto('/istanbul');
      await page.locator('.atlas-bottom-nav__button').filter({ hasText: 'Karşılaştır' }).click();
      await expect(page.locator('.hava81-compare__empty')).toBeVisible();
      await expect(page.locator('#hava81-compare-title')).toHaveCSS('outline-style', 'none');
      await expect(page.locator('.hava81-compare__empty-action')).toHaveText(/Şehirleri keşfet/);
      await page.locator('.hava81-compare__empty-action').click();
      await expect(page.locator('.decision-glance')).toBeVisible();
    }
  );

  test(
    'mobile saved navigation does not create a favorite just by opening the view',
    MOBILE,
    async ({ page }) => {
      await page.goto('/istanbul');
      await expect(page.evaluate(() => localStorage.getItem('favorites'))).resolves.toBeNull();

      await page.getByRole('button', { name: 'Karşılaştır' }).click();

      await expect(page.getByRole('heading', { name: /Şehir karşılaştırması/i })).toBeVisible();
      await expect(page.getByText(/en az iki şehri favorilere ekle/i)).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('favorites'))).toBeNull();
      await expect(page.getByRole('button', { name: /favorilere ekle/i })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    }
  );

  test(
    'desktop Compare control marks only the active view as the current page',
    DESKTOP,
    async ({ page }) => {
      await seedFavorites(page, TWO_FAVORITES);
      await page.goto('/istanbul/');
      const compare = page.locator('.atlas-compare-button');
      await expect(compare).toBeVisible();
      await expect(compare).not.toHaveAttribute('aria-current');
      await compare.click();
      await expect(
        page.getByRole('heading', { level: 1, name: /Şehir karşılaştırması/i })
      ).toBeVisible();
      await expect(compare).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('.atlas-dashboard')).toHaveCount(0);
      await expect(compare).not.toHaveAttribute('aria-pressed');
    }
  );

  test('mobile saved navigation replaces the today dashboard', MOBILE, async ({ page }) => {
    await seedFavorites(page, TWO_FAVORITES);
    await page.goto('/istanbul');
    await page.getByRole('button', { name: 'Karşılaştır' }).click();
    await expect(page.getByRole('heading', { name: /Şehir karşılaştırması/i })).toBeVisible();
    await expect(page.locator('.atlas-dashboard')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Karşılaştır' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test(
    'saved comparison stays readable at 100% and 200% text from 320px to 768px',
    MOBILE,
    async ({ page }) => {
      await seedSettings(page, { language: 'en', themeMode: 'dark' });
      await seedFavorites(page, [
        { name: 'Kahramanmaraş' },
        { name: 'Afyonkarahisar' },
        { name: 'Şanlıurfa' },
      ]);
      await overrideApi(page, 'current', route => {
        const requestedCity =
          new URL(route.request().url()).searchParams.get('city') ?? current.cityName;
        return route.fulfill({ json: { ...current, cityName: requestedCity } });
      });
      await setWidth(page, 320, 844);
      await page.goto('/istanbul');
      await page
        .locator('.atlas-bottom-nav__button')
        .filter({ hasText: /Compare|Karşılaştır/ })
        .click();
      const compare = page.locator('.hava81-compare');
      await expect(compare.locator('.hava81-compare__city')).toHaveCount(3);

      for (const [width, scale] of [
        [320, 100],
        [320, 200],
        [390, 200],
        [768, 200],
      ] as const) {
        await setWidth(page, width, 1024);
        await setTextScale(page, scale);
        const at = `${width}px/${scale}%`;
        await expectReadable(page, compare, at);
        for (const city of await compare.locator('.hava81-compare__city').all()) {
          await expectContainedIn(city.locator('h2'), city, `city name ${at}`);
          await expectContainedIn(city.locator('.hava81-compare__metrics'), city, `metrics ${at}`);
        }
      }
    }
  );
});

test.describe('saved city tabs', () => {
  test('saved city tab rail scrolls inside the page at 200% text', MOBILE, async ({ page }) => {
    await seedFavorites(page, [
      { name: 'Kahramanmaraş', lat: 37.58, lon: 36.93 },
      { name: 'Afyonkarahisar', lat: 38.75, lon: 30.54 },
      { name: 'Şanlıurfa', lat: 37.16, lon: 38.79 },
    ]);
    await setWidth(page, 320, 844);
    await page.goto('/istanbul');
    await setTextScale(page, 200);
    await page
      .locator('.atlas-bottom-nav__button')
      .filter({ hasText: /Compare|Karşılaştır/ })
      .click();
    const rail = page.locator('.city-tabs__scroll');
    await expect(rail).toBeVisible();

    for (const width of [320, 390]) {
      await setWidth(page, width, 844);
      const at = `${width}px/200%`;
      await expectWithinViewportWidth(rail, at);
      expect(
        await rail.evaluate(element => element.scrollWidth > element.clientWidth),
        `rail scrolls ${at}`
      ).toBe(true);
      expect(await findUndersizedTargets(rail), `tab targets ${at}`).toEqual([]);
      await expectNoHorizontalScroll(page, at);
    }
  });

  test(
    'saved city add action keeps its focus ring inside the scroll rail',
    MOBILE,
    async ({ page }) => {
      await seedFavorites(page, [{ name: 'Ankara', lat: 39.93, lon: 32.86 }]);
      await page.goto('/istanbul');
      await page
        .locator('.atlas-bottom-nav__button')
        .filter({ hasText: /Compare|Karşılaştır/ })
        .click();
      const add = page.locator('.city-tabs__add');
      await expect(add).toBeVisible();
      await expectVisibleFocusRing(add, { insideClippingRail: true });
    }
  );
});
