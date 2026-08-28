import { expect, test } from '@playwright/test';

const current = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 23,
  feelsLike: 23,
  tempMin: 19,
  tempMax: 27,
  humidity: 58,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 4.2,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: '2026-08-28T03:20:00.000Z',
  sunset: '2026-08-28T16:35:00.000Z',
  timestamp: '2026-08-28T09:00:00.000Z',
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 5,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date().toISOString(),
    timezoneOffsetSeconds: 10800,
    cacheStatus: 'MISS',
    freshForSeconds: 60,
  },
};
const forecast = {
  daily: [
    { date: '2026-08-28', tempMin: 19, tempMax: 27, icon: '01d', description: 'açık', pop: 10 },
  ],
  hourly: [
    {
      time: '2026-08-28T09:00:00.000Z',
      temp: 23,
      icon: '01d',
      description: 'açık',
      pop: 10,
      windSpeed: 4,
    },
    {
      time: '2026-08-28T12:00:00.000Z',
      temp: 26,
      icon: '01d',
      description: 'açık',
      pop: 5,
      windSpeed: 5,
    },
  ],
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date().toISOString(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 3,
    cacheStatus: 'MISS',
    freshForSeconds: 300,
  },
};
const air = {
  aqi: 2,
  aqiLabel: 'Orta',
  pm25: 9,
  pm10: 14,
  o3: 42,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date().toISOString(),
    cacheStatus: 'MISS',
    freshForSeconds: 120,
  },
};
const context = {
  provider: 'Open-Meteo',
  fetchedAt: new Date().toISOString(),
  attribution: 'Open-Meteo · CC BY 4.0',
  uvIndexMax: 7.1,
  dustMax: 12,
  grassPollenMax: 4,
  olivePollenMax: 1,
  units: {
    dust: 'μg/m³',
    grassPollen: 'grains/m³',
    olivePollen: 'grains/m³',
    waveHeight: 'm',
    seaSurfaceTemperature: '°C',
  },
  marine: { observedAt: new Date().toISOString(), waveHeight: 0.3, seaSurfaceTemperature: 24.8 },
};

const routeResult = {
  kind: 'corridor-estimate',
  estimatedDistanceKm: 413,
  estimatedDurationMinutes: 331,
  requestedDeparture: new Date().toISOString(),
  score: 84,
  segments: [0, 0.25, 0.5, 0.75, 1].map((fraction, index) => ({
    fraction,
    lat: 41 - index * 0.25,
    lon: 29 + index * 0.9,
    eta: new Date(Date.now() + index * 60 * 60_000).toISOString(),
    temperature: 22 + index,
    precipitationProbability: index === 2 ? 30 : 5,
    windSpeed: 4 + index,
    description: index === 2 ? 'hafif yağmur' : 'açık',
    score: index === 2 ? 70 : 88,
    risk: index === 2 ? 'caution' : 'low',
  })),
  disclaimer: 'Bu sonuç gerçek yol/navigasyon rotası değildir.',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ json: air }));
  await page.route('**/api/v1/weather/context**', route => route.fulfill({ json: context }));
  await page.route('**/api/v1/weather/route**', route => route.fulfill({ json: routeResult }));
});

test('core city experience renders and uses a shareable city URL', async ({ page }) => {
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page).toHaveURL(/\/istanbul\/$/);
  await expect(page.getByText(/OpenWeather/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Gün planı/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Bugün ne yapacaksın/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Güneş, toz, polen ve deniz/i })).toBeVisible();
  await expect(page.getByText('UV indeksi', { exact: true })).toBeVisible();
  await expect(page.getByText(/Rota havası/i)).toBeVisible();
});

test('browser and install surfaces use Hava81 branding assets', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser coverage for brand assets');

  await page.goto('/istanbul');

  const iconHrefs = await page.locator('link[rel="icon"]').evaluateAll(elements =>
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
    'https://hava81.zekiakgul.dev/hava81-social-card.png?v=20260828'
  );
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
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
      };
    };

    return Promise.all([
      readImage('/logo192.png'),
      readImage('/logo512.png'),
      readImage('/apple-touch-icon.png?v=20260828'),
      readImage('/hava81-favicon.ico?v=20260828'),
      readImage('/hava81-social-card.png?v=20260828'),
    ]);
  });

  expect(samples[0]).toMatchObject({ width: 192, height: 192, center: [231, 165, 49, 255] });
  expect(samples[1]).toMatchObject({ width: 512, height: 512, center: [231, 165, 49, 255] });
  expect(samples[2]).toMatchObject({ width: 180, height: 180, center: [231, 165, 49, 255] });
  expect(samples[3].width).toBeGreaterThanOrEqual(32);
  expect(samples[3].center[0]).toBeGreaterThan(200);
  expect(samples[3].center[1]).toBeGreaterThan(120);
  expect(samples[3].center[2]).toBeLessThan(100);
  expect(samples[4]).toMatchObject({ width: 1200, height: 630 });
});

test('theme choice keeps browser chrome color in sync', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser theme metadata coverage');

  await page.goto('/istanbul');
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  expect(
    await page.locator('meta[name="theme-color"]').evaluateAll(elements =>
      elements.map(element => (element as HTMLMetaElement).content)
    )
  ).toEqual(['#F3F6F4', '#F3F6F4']);

  await page.getByRole('button', { name: /ayarlar/i }).click();
  await page.getByRole('button', { name: 'Koyu' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
  expect(
    await page.locator('meta[name="theme-color"]').evaluateAll(elements =>
      elements.map(element => (element as HTMLMetaElement).content)
    )
  ).toEqual(['#0E2C32', '#0E2C32']);
});

test('production HTML bootstraps current weather without a duplicate app request', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser coverage for early current weather');

  let currentRequests = 0;
  page.on('request', request => {
    if (request.url().includes('/api/v1/weather/current')) currentRequests += 1;
  });

  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
  expect(currentRequests).toBe(1);
});

test('fresh cached weather suppresses the generated bootstrap request', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser coverage for bootstrap cache guard');

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
});

test('lazy forecast chunk does not block the decision-first view', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser coverage for lazy chunk timing');

  await page.route('**/assets/ForecastAtlas-*.js', async route => {
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.continue();
  });

  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Bugünün ritmi/i })).toBeVisible();
});

test('recovers once when a lazy chunk disappears during deploy', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser coverage for deploy recovery');

  let forecastChunkRequests = 0;
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
  await expect(page.getByRole('heading', { name: /Bugünün ritmi/i })).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/istanbul\/$/);
  expect(forecastChunkRequests).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.app-fatal')).toHaveCount(0);
});

test('current conditions stay in the first mobile viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile viewport assertion');
  await page.goto('/istanbul');
  const heading = page.getByRole('heading', { name: 'İstanbul' });
  await expect(heading).toBeVisible();
  const box = await heading.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? 1000) + (box?.height ?? 0)).toBeLessThan(844);
});

test('mobile interactive controls preserve 44px touch targets', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile touch target coverage');

  await page.goto('/istanbul');

  const undersized = await page
    .locator('button, a, input, select, textarea, [role="button"]')
    .evaluateAll(elements =>
      elements
        .map(element => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden';
          return {
            label:
              element.getAttribute('aria-label') ||
              element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60) ||
              element.tagName,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            visible,
          };
        })
        .filter(target => target.visible && (target.width < 44 || target.height < 44))
    );

  expect(undersized).toEqual([]);
});

test('desktop comparison entry works with two saved cities', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop comparison assertion');
  await page.addInitScript(() => {
    localStorage.setItem(
      'favorites',
      JSON.stringify([
        { name: 'İstanbul', lat: 41.01, lon: 28.97 },
        { name: 'İzmir', lat: 38.42, lon: 27.14 },
      ])
    );
  });
  await page.goto('/istanbul');
  await page.getByRole('button', { name: /Karşılaştır/i }).click();
  await expect(page.getByRole('heading', { name: /Şehir karşılaştırması/i })).toBeVisible();
});

test('activity preference changes the personalized plan', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop interaction assertion');
  await page.goto('/istanbul');
  const picnic = page.getByRole('button', { name: 'Piknik' });
  await expect(picnic).toHaveAttribute('aria-pressed', 'false');
  await picnic.click();
  await expect(picnic).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Piknik' })).toBeVisible();
});

test('route weather renders a transparent corridor result', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop route assertion');
  await page.goto('/istanbul');
  await page.getByText('Rota havası', { exact: true }).click();
  await page.getByRole('button', { name: /koridoru kontrol et/i }).click();
  await expect(page.getByRole('heading', { name: /İstanbul → Ankara/i })).toBeVisible();
  await expect(page.getByText(/gerçek yol\/navigasyon rotası değildir/i)).toBeVisible();
  await expect(
    page.getByRole('list', { name: /rota boyunca hava örnekleri/i }).getByRole('listitem')
  ).toHaveCount(5);
});


test('production shell exposes an installable PWA contract', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser PWA coverage');

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
  expect(await workerResponse.text()).toContain("self.addEventListener('notificationclick'");

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
});
