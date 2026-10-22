import { DESKTOP, expect, test } from './helpers/test';
import { expectNoHorizontalScroll, setWidth } from './helpers/layout';
import { fixtures } from './helpers/weather-fixtures';

const { current } = fixtures;

// Install surfaces, service worker, early bootstrap and lazy-chunk resilience.
// These are single-browser checks: the behaviour does not depend on viewport.
test.describe('PWA and branding', () => {
  test('browser and install surfaces use Hava81 branding assets', DESKTOP, async ({ page }) => {
    await page.goto('/istanbul');

    const iconHrefs = await page
      .locator('link[rel="icon"]')
      .evaluateAll(elements =>
        elements.map(element => (element as HTMLLinkElement).getAttribute('href'))
      );
    expect(iconHrefs).toEqual(
      expect.arrayContaining(['/hava81-mark.svg?v=20260828', '/hava81-favicon.ico?v=20260828'])
    );

    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      '/apple-touch-icon.png?v=20260828'
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://hava81.zekiakgul.dev/hava81-social-card.png?v=20261022'
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
      'content',
      '1200'
    );
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute(
      'content',
      '630'
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image'
    );

    const samples = await page.evaluate(async () => {
      const readImage = async (src: string) => {
        const image = new Image();
        image.src = src;
        await image.decode();

        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('2D canvas unavailable');
        context.drawImage(image, 0, 0);

        let maxContentRadius: number | null = null;
        if (src.includes('maskable')) {
          const { data } = context.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
          const background = data.slice(0, 4);
          const centerX = (image.naturalWidth - 1) / 2;
          const centerY = (image.naturalHeight - 1) / 2;
          let measuredRadius = 0;
          for (let y = 0; y < image.naturalHeight; y += 1) {
            for (let x = 0; x < image.naturalWidth; x += 1) {
              const offset = (y * image.naturalWidth + x) * 4;
              const differsFromBackground = [0, 1, 2].some(
                channel => Math.abs(data[offset + channel] - background[channel]) > 8
              );
              if (!differsFromBackground) continue;
              measuredRadius = Math.max(measuredRadius, Math.hypot(x - centerX, y - centerY));
            }
          }
          maxContentRadius = measuredRadius;
        }

        return {
          width: image.naturalWidth,
          height: image.naturalHeight,
          center: Array.from(
            context.getImageData(
              Math.floor(image.naturalWidth / 2),
              Math.floor(image.naturalHeight / 2),
              1,
              1
            ).data
          ),
          maxContentRadius,
        };
      };

      return Promise.all([
        readImage('/hava81-icon-192.png'),
        readImage('/hava81-icon-512.png'),
        readImage('/hava81-maskable-512.png'),
        readImage('/apple-touch-icon.png?v=20260828'),
        readImage('/hava81-favicon.ico?v=20260828'),
        readImage('/hava81-social-card.png?v=20261022'),
      ]);
    });

    expect(samples[0]).toMatchObject({ width: 192, height: 192, center: [231, 165, 49, 255] });
    expect(samples[1]).toMatchObject({ width: 512, height: 512, center: [231, 165, 49, 255] });
    expect(samples[2]).toMatchObject({ width: 512, height: 512, center: [231, 165, 49, 255] });
    expect(samples[2].maxContentRadius).not.toBeNull();
    expect(samples[2].maxContentRadius ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(512 * 0.4);
    expect(samples[3]).toMatchObject({ width: 180, height: 180, center: [231, 165, 49, 255] });
    expect(samples[4].width).toBeGreaterThanOrEqual(32);
    expect(samples[4].center[0]).toBeGreaterThan(200);
    expect(samples[4].center[1]).toBeGreaterThan(120);
    expect(samples[4].center[2]).toBeLessThan(100);
    expect(samples[5]).toMatchObject({ width: 1200, height: 630 });
  });

  test('PWA metadata advertises standard standalone capability', DESKTOP, async ({ page }) => {
    await page.goto('/istanbul');
    await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
      'content',
      'yes'
    );
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
      'content',
      'yes'
    );
  });

  test(
    'production shell exposes an installable PWA contract',
    DESKTOP,
    async ({ page, request }) => {
      const manifestResponse = await request.get('/manifest.json');
      expect(manifestResponse.ok()).toBeTruthy();
      const manifest = await manifestResponse.json();
      expect(manifest).toMatchObject({
        name: expect.stringContaining('Hava81'),
        start_url: '/',
        scope: '/',
        display: 'standalone',
      });
      expect(manifest.icons?.length).toBeGreaterThanOrEqual(2);

      const workerResponse = await request.get('/sw.js');
      expect(workerResponse.ok()).toBeTruthy();
      const workerSource = await workerResponse.text();
      expect(workerSource).toContain("self.addEventListener('notificationclick'");
      expect(workerSource).toContain("fetch(request, { cache: 'no-store' })");

      await page.goto('/istanbul/');
      const registration = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return null;
        const ready = await navigator.serviceWorker.ready;
        return { scope: ready.scope, active: Boolean(ready.active) };
      });
      expect(registration?.active).toBe(true);
      expect(registration?.scope).toMatch(/\/$/);

      // Reload once under service-worker control so the visited city shell and hashed assets are cached.
      await page.reload();
      await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();

      // Stable root branding URLs must stay network-fresh; only fingerprinted /assets/ resources are
      // cache-first. This prevents an old logo/icon from surviving a later brand refresh indefinitely.
      await page.evaluate(async () => {
        await fetch('/hava81-mark.svg?sw-cache-probe=1');
      });
      const cachedUrls = await page.evaluate(async () => {
        const urls: string[] = [];
        for (const key of await caches.keys()) {
          const cache = await caches.open(key);
          urls.push(...(await cache.keys()).map(request => request.url));
        }
        return urls;
      });
      expect(cachedUrls.some(url => new URL(url).pathname === '/hava81-mark.svg')).toBe(false);
      expect(cachedUrls.some(url => new URL(url).pathname.startsWith('/assets/'))).toBe(true);

      await page.context().setOffline(true);
      try {
        await page.reload();
        await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
      } finally {
        await page.context().setOffline(false);
      }
    }
  );

  test('service worker update checks bypass the HTTP cache', DESKTOP, async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.updateViaCache === 'none';
    });
    const updateViaCache = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.updateViaCache;
    });
    expect(updateViaCache).toBe('none');
  });
});

test.describe('bootstrap and lazy chunks', () => {
  test(
    'production HTML bootstraps current and hourly weather without duplicate app requests',
    DESKTOP,
    async ({ page }) => {
      let currentRequests = 0;
      let hourlyRequests = 0;
      page.on('request', request => {
        if (request.url().includes('/api/v1/weather/current')) currentRequests += 1;
        if (request.url().includes('/api/v1/weather/hourly')) hourlyRequests += 1;
      });

      await page.goto('/istanbul');
      await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
      await expect(page.locator('.hava81-forecast-atlas')).toBeVisible();
      expect(currentRequests).toBe(1);
      expect(hourlyRequests).toBe(1);
    }
  );

  test(
    'fresh cached weather suppresses the generated bootstrap request',
    DESKTOP,
    async ({ page }) => {
      await page.addInitScript(cachedWeather => {
        window.localStorage.setItem(
          'weather_cache',
          JSON.stringify({ data: cachedWeather, timestamp: Date.now(), language: 'tr' })
        );
      }, current);

      let currentRequests = 0;
      page.on('request', request => {
        if (request.url().includes('/api/v1/weather/current')) currentRequests += 1;
      });

      await page.goto('/istanbul');
      await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
      expect(currentRequests).toBe(0);
    }
  );

  test('lazy forecast chunk does not block the decision-first view', DESKTOP, async ({ page }) => {
    await page.route('**/assets/ForecastAtlas-*.js', async route => {
      await new Promise(resolve => setTimeout(resolve, 350));
      await route.continue();
    });

    await page.goto('/istanbul');
    await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Bugünün ritmi/i })).toBeVisible();
  });

  test(
    'cold forecast chunk keeps a visible skeleton instead of blank dashboard space',
    DESKTOP,
    async ({ page }) => {
      // Service-worker cache can satisfy imported chunks before Playwright routes
      // see them. Force a genuine cold import for this regression.
      await page.addInitScript(() => {
        Object.defineProperty(navigator.serviceWorker, 'register', {
          configurable: true,
          value: () => Promise.reject(new Error('service worker disabled for cold-chunk test')),
        });
      });
      await page.route('**/sw.js', route => route.abort());
      let releaseChunk: (() => void) | undefined;
      let chunkRequested = false;
      const pausedChunk = new Promise<void>(resolve => {
        releaseChunk = resolve;
      });
      await page.route('**/assets/ForecastAtlas-*.js', async route => {
        chunkRequested = true;
        await pausedChunk;
        await route.continue();
      });

      try {
        await page.goto('/istanbul/');
        await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
        await expect.poll(() => chunkRequested).toBe(true);
        const skeleton = page.locator('.atlas-forecast-loading--card');
        // The skeleton holds the forecast slot in the first screen.
        await expect(skeleton).toBeInViewport();
        await expect(skeleton.getByRole('heading', { name: 'Bugünün ritmi' })).toBeVisible();
        await expectNoHorizontalScroll(page, 'desktop skeleton');
        await setWidth(page, 320, 844);
        await expect(skeleton).toBeVisible();
        await expectNoHorizontalScroll(page, '320px skeleton');
      } finally {
        releaseChunk?.();
      }
      await expect(page.locator('.atlas-forecast-loading--card')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Bugünün ritmi' })).toBeVisible();
    }
  );

  test('recovers once when a lazy chunk disappears during deploy', DESKTOP, async ({ page }) => {
    let forecastChunkRequests = 0;
    await page.addInitScript(() => {
      Object.defineProperty(navigator.serviceWorker, 'register', {
        configurable: true,
        value: () =>
          Promise.reject(new Error('service worker disabled for cold-cache recovery test')),
      });
    });
    await page.route('**/sw.js', route => route.abort());
    await page.route('**/assets/ForecastAtlas-*.js', async route => {
      forecastChunkRequests += 1;
      if (forecastChunkRequests === 1) {
        await route.fulfill({ status: 404, contentType: 'text/javascript', body: '' });
        return;
      }
      await route.continue();
    });

    await page.goto('/istanbul');
    await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
    // A visible skeleton now deliberately shares this heading with the real
    // forecast. Wait for the lazy component itself before asserting recovery.
    await expect(page.locator('.hava81-forecast-atlas')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.atlas-forecast-loading--card')).toHaveCount(0);
    await expect(page).toHaveURL(/\/istanbul\/$/);
    await expect.poll(() => forecastChunkRequests).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.app-fatal')).toHaveCount(0);
  });

  test(
    'chunk recovery URL guard prevents reload loops without sessionStorage',
    DESKTOP,
    async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'sessionStorage', {
          configurable: true,
          get() {
            throw new DOMException('Storage blocked', 'SecurityError');
          },
        });
        Object.defineProperty(navigator.serviceWorker, 'register', {
          configurable: true,
          value: () =>
            Promise.reject(new Error('service worker disabled for cold-cache recovery test')),
        });
      });

      await page.route('**/sw.js', route => route.abort());
      await page.route('**/assets/ForecastAtlas-*.js', route =>
        route.fulfill({ status: 404, contentType: 'text/javascript', body: '' })
      );

      const mainFrameUrls: string[] = [];
      page.on('framenavigated', frame => {
        if (frame === page.mainFrame()) mainFrameUrls.push(frame.url());
      });

      await page.goto('/istanbul/');
      await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
      await page.waitForTimeout(2_000);

      expect(mainFrameUrls.filter(url => url.includes('__hava81_chunk_reload=')).length).toBe(1);
      await expect(page).toHaveURL(/\/istanbul\/$/);
    }
  );
});
