import { expect, test } from '@playwright/test';

const fixtureNow = Date.now();
const fixtureIsoAtHour = (offsetHours: number) =>
  new Date(fixtureNow + offsetHours * 60 * 60_000).toISOString();
const fixtureLocalDate = (offsetDays = 0) =>
  new Date(fixtureNow + 3 * 60 * 60_000 + offsetDays * 24 * 60 * 60_000).toISOString().slice(0, 10);

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
  sunrise: fixtureIsoAtHour(-6),
  sunset: fixtureIsoAtHour(6),
  timestamp: fixtureIsoAtHour(0),
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
    { date: fixtureLocalDate(), tempMin: 19, tempMax: 27, icon: '01d', description: 'açık', pop: 10 },
  ],
  hourly: [
    {
      time: fixtureIsoAtHour(1),
      temp: 23,
      icon: '01d',
      description: 'açık',
      pop: 10,
      windSpeed: 4,
    },
    {
      time: fixtureIsoAtHour(4),
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
const hourlyForecast = {
  hourly: Array.from({ length: 24 }, (_, index) => ({
    time: new Date(Date.parse('2026-08-28T09:00:00.000Z') + index * 60 * 60_000).toISOString(),
    temp: 22 - Math.floor(index / 6),
    icon: index < 3 ? '01d' : '02n',
    description: index < 3 ? 'açık' : 'çoğunlukla açık',
    pop: index === 4 ? 45 : 10,
    precipitationMm: index === 4 ? 0.2 : 0,
    windSpeed: 3 + index * 0.05,
  })),
  meta: {
    provider: 'Open-Meteo',
    attribution: 'Open-Meteo · CC BY 4.0',
    sourceUrl: 'https://open-meteo.com/',
    fetchedAt: new Date().toISOString(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 1,
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
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: hourlyForecast }));
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
  const hourlyHeading = page.getByRole('heading', { name: /Saatlik tahmin · sonraki 24 saat/i });
  await expect(hourlyHeading).toBeVisible();
  const hourlySection = hourlyHeading.locator('..');
  await expect(hourlySection.getByRole('link', { name: 'Open-Meteo' })).toHaveAttribute(
    'href',
    'https://open-meteo.com/'
  );
  await expect(hourlySection.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute(
    'href',
    'https://creativecommons.org/licenses/by/4.0/'
  );
  await expect(page.locator('.hava81-forecast-atlas__source')).toContainText(
    'Hava81 tarafından biçimlendirildi'
  );
  await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(24);
  await expect(page.getByRole('heading', { name: /Gün planı/i })).toBeVisible();
  const dailyPlan = page.locator('.daily-plan');
  await expect(dailyPlan).toContainText('%45 · 0,2 mm');
  await expect(dailyPlan.getByText('Makul', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Bugün ne yapacaksın/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Güneş, toz, polen ve deniz/i })).toBeVisible();
  await expect(page.getByText('UV · 24s model maksimumu', { exact: true })).toBeVisible();
  await expect(page.getByText(/Rota havası/i)).toBeVisible();
});


test('daily plan timeline matches its 12-hour score horizon and shows risk-first slot copy', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser daily-plan coverage');
  await page.unroute('**/api/v1/weather/hourly**');
  await page.route('**/api/v1/weather/hourly**', route =>
    route.fulfill({
      json: {
        ...hourlyForecast,
        hourly: Array.from({ length: 24 }, (_, index) => ({
          ...hourlyForecast.hourly[index],
          time: new Date(Date.parse('2026-08-28T18:00:00.000Z') + index * 60 * 60_000).toISOString(),
          pop: index === 4 ? 45 : 10,
          precipitationMm: 0,
          windGust: 5,
          apparentTemperature: 24,
          humidity: 50,
          uvIndex: 0,
          visibility: 20000,
          weatherCode: 2,
        })),
      },
    })
  );

  await page.goto('/istanbul');
  const timeline = page.getByRole('list', { name: 'Günün hava uygunluk zaman çizelgesi' });
  await expect(timeline.locator('.daily-plan__slot')).toHaveCount(12);
  await expect(timeline).not.toContainText('Çok uygun');
  await expect(timeline.getByText('Yağış ihtimali var')).toBeVisible();
  await expect(timeline.getByText('Yarın')).toHaveCount(1);
});

test('hourly interval controls resample the same 24-hour forecast', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser interval coverage');
  await page.goto('/istanbul');

  const interval = page.getByRole('group', { name: 'Tahmin aralığı' });
  await expect(interval.getByRole('button', { name: '1 saatlik' })).toHaveAttribute('aria-pressed', 'true');
  await expect(interval.getByRole('button', { name: '3 saatlik' })).toBeVisible();
  await expect(interval.getByRole('button', { name: '6 saatlik' })).toBeVisible();
  await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(24);

  const displayedTimes = async () =>
    page.locator('.hava81-forecast-atlas__hour time > span:last-child').allTextContents();

  await interval.getByRole('button', { name: '3 saatlik' }).click();
  await expect(page.getByRole('heading', { name: /Saatlik tahmin · sonraki 24 saat/i })).toBeVisible();
  await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(8);
  expect((await displayedTimes()).slice(0, 4)).toEqual(['12:00', '15:00', '18:00', '21:00']);
  await expect(page.locator('.hava81-forecast-atlas__hour-day')).toHaveCount(1);
  await expect(
    page.locator('.hava81-forecast-atlas__hour.is-day-boundary')
  ).toContainText('00:00');

  await interval.getByRole('button', { name: '6 saatlik' }).click();
  await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(4);
  expect(await displayedTimes()).toEqual(['12:00', '18:00', '00:00', '06:00']);
});

test('hourly display falls back to the existing three-hour forecast when the hourly source fails', async ({
  page,
}) => {
  await page.unroute('**/api/v1/weather/hourly**');
  await page.route('**/api/v1/weather/hourly**', route =>
    route.fulfill({ status: 503, json: { error: { code: 'HOURLY_PROVIDER_ERROR' } } })
  );

  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: /3 saat aralıklarla tahmin/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Gün planı/i })).toBeVisible();
});

test('browser and install surfaces use Hava81 branding assets', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser coverage for brand assets');

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
      readImage('/hava81-social-card.png?v=20260828'),
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

test('theme choice keeps browser chrome color in sync', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser theme metadata coverage');

  await page.goto('/istanbul');
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  expect(
    await page
      .locator('meta[name="theme-color"]')
      .evaluateAll(elements => elements.map(element => (element as HTMLMetaElement).content))
  ).toEqual(['#F3F6F4', '#F3F6F4']);

  await page.getByRole('button', { name: /ayarlar/i }).click();
  await page.getByRole('button', { name: 'Koyu' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
  expect(
    await page
      .locator('meta[name="theme-color"]')
      .evaluateAll(elements => elements.map(element => (element as HTMLMetaElement).content))
  ).toEqual(['#0E2C32', '#0E2C32']);
});

test('production HTML bootstraps current weather without a duplicate app request', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'single browser coverage for early current weather'
  );

  let currentRequests = 0;
  page.on('request', request => {
    if (request.url().includes('/api/v1/weather/current')) currentRequests += 1;
  });

  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
  expect(currentRequests).toBe(1);
});

test('fresh cached weather suppresses the generated bootstrap request', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'single browser coverage for bootstrap cache guard'
  );

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
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'single browser coverage for lazy chunk timing'
  );

  await page.route('**/assets/ForecastAtlas-*.js', async route => {
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.continue();
  });

  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Bugünün ritmi/i })).toBeVisible();
});

test('recovers once when a lazy chunk disappears during deploy', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'single browser coverage for deploy recovery'
  );

  let forecastChunkRequests = 0;
  await page.addInitScript(() => {
    Object.defineProperty(navigator.serviceWorker, 'register', {
      configurable: true,
      value: () => Promise.reject(new Error('service worker disabled for cold-cache recovery test')),
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
  await expect(page.getByRole('heading', { name: /Bugünün ritmi/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page).toHaveURL(/\/istanbul\/$/);
  expect(forecastChunkRequests).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.app-fatal')).toHaveCount(0);
});

test('chunk recovery URL guard prevents reload loops without sessionStorage', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'single browser coverage for storage-restricted deploy recovery'
  );

  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    });
    Object.defineProperty(navigator.serviceWorker, 'register', {
      configurable: true,
      value: () => Promise.reject(new Error('service worker disabled for cold-cache recovery test')),
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
});

test('English mode updates document language and decision copy', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser language coverage');

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'metric',
        windSpeedUnit: 'ms',
        themeMode: 'light',
        language: 'en',
      })
    );
  });
  await page.goto('/istanbul/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('İstanbul weather — Hava81');
  await expect(page.getByRole('heading', { name: 'Planning signals' })).toBeVisible();
  await expect(page.locator('.hava81-decision-field__decision-list')).not.toContainText(
    'civarında'
  );
  await expect(page.locator('.hava81-decision-field__decision-list')).not.toContainText(
    'güneş koruması'
  );
});

test('service worker update checks bypass the HTTP cache', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser PWA coverage');
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

test('mobile header keeps current-location action reachable without horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile header assertion');
  await page.goto('/istanbul');

  const locationAction = page.locator('.atlas-icon-button--location');
  await expect(locationAction).toBeVisible();
  await expect(locationAction).toHaveAttribute('aria-label', /konum/i);

  expect(
    await page.locator('.atlas-header__inner').evaluate(element => element.scrollWidth <= element.clientWidth)
  ).toBe(true);

  await page.setViewportSize({ width: 320, height: 700 });
  await expect(locationAction).toBeVisible();
  expect(
    await page.locator('.atlas-header__inner').evaluate(element => element.scrollWidth <= element.clientWidth)
  ).toBe(true);
});

test('lazy forecast atlas renders hourly and daily guidance after city data loads', async ({ page }) => {
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: "Bugünün ritmi" })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Saatlik tahmin · sonraki 24 saat/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /5 Günlük Tahmin/i })).toBeVisible();
  await expect(page.getByRole('region', { name: /Kaydırılabilir saatlik tahmin/i })).toBeVisible();
});

test('desktop daily forecast keeps full condition labels readable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop daily forecast layout assertion');
  await page.unroute('**/api/v1/weather/forecast**');
  await page.route('**/api/v1/weather/forecast**', route =>
    route.fulfill({
      json: {
        ...forecast,
        daily: [
          {
            date: fixtureLocalDate(),
            tempMin: 20,
            tempMax: 28,
            icon: '02d',
            description: 'parçalı bulutlu',
            pop: 10,
          },
          {
            date: fixtureLocalDate(1),
            tempMin: 17,
            tempMax: 23,
            icon: '11d',
            description: 'gök gürültülü fırtına',
            pop: 73,
            precipitationMm: 11.6,
          },
        ],
      },
    })
  );

  await page.goto('/istanbul');
  const conditions = page.locator('.hava81-forecast-atlas__description');
  await expect(conditions).toHaveCount(2);
  await expect(conditions.getByText('gök gürültülü fırtına')).toBeVisible();
  expect(
    await conditions.evaluateAll(elements =>
      elements
        .filter(element => element.scrollWidth > element.clientWidth + 1)
        .map(element => element.textContent?.trim())
    )
  ).toEqual([]);
});

test('desktop dashboard uses the decision column instead of leaving dead space', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop composition assertion');
  await page.goto('/istanbul');
  await expect(page.locator('.commute-plan')).toBeVisible();
  await expect(page.locator('.activity-card')).toHaveCount(2);

  const layout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width };
    };
    const activity = rect('.activity-planner__cards');
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.activity-card')).map(element => {
      const box = element.getBoundingClientRect();
      return { width: box.width, left: box.left, right: box.right };
    });
    return {
      decision: rect('.hava81-decision-field'),
      forecast: rect('.hava81-forecast-atlas'),
      commute: rect('.commute-plan'),
      daily: rect('.daily-plan'),
      activity,
      cards,
    };
  });

  expect(Math.abs(layout.commute.left - layout.decision.left)).toBeLessThan(2);
  expect(layout.commute.top).toBeGreaterThanOrEqual(layout.decision.bottom + 8);
  expect(layout.forecast.left).toBeGreaterThanOrEqual(layout.decision.right + 8);
  expect(layout.daily.top).toBeGreaterThanOrEqual(
    Math.max(layout.commute.bottom, layout.forecast.bottom) + 8
  );
  expect(Math.min(...layout.cards.map(card => card.width))).toBeGreaterThan(layout.activity.width * 0.45);
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
  await expect(
    page.locator('.hava81-forecast-atlas__source').getByRole('link', { name: 'Open-Meteo' })
  ).toBeVisible();
  await expect(
    page.locator('.context-signals__source').getByRole('link', { name: 'Open-Meteo' })
  ).toBeVisible();

  const undersized = await page
    .locator('button, a, input, select, textarea, summary, [role="button"]')
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

test('activity preference and time range change the personalized plan', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop interaction assertion');
  await page.goto('/istanbul');
  const picnic = page.getByRole('button', { name: 'Piknik' });
  await expect(picnic).toHaveAttribute('aria-pressed', 'false');
  await picnic.click();
  await expect(picnic).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Piknik' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Başlangıç' }).fill('18:00');
  await page.getByRole('textbox', { name: 'Bitiş' }).fill('20:00');
  await expect(page.getByText('18:00–20:00 uygunluğu').first()).toBeVisible();
  await expect(page.getByText(/Koşuda 10–22°C/)).toBeVisible();
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

test('production shell exposes an installable PWA contract', async ({
  page,
  request,
}, testInfo) => {
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
});

test('out-and-back plan persists routine times and produces a preparation decision', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser routine-plan coverage');

  await page.clock.setFixedTime(new Date('2026-08-28T08:00:00Z'));
  await page.goto('/istanbul/');
  await expect(page.getByRole('heading', { name: 'Çıkış planı' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Çıkış', exact: true }).fill('12:00');
  await page.getByRole('textbox', { name: 'Dönüş', exact: true }).fill('15:00');
  await expect(
    page.getByText(
      /Şemsiyeyi al|Şemsiye yanında olsun|Ekstra hava hazırlığı gerekmiyor|su ve gölge planla|Rüzgâr\/hamle/
    )
  ).toBeVisible();
  await expect(page.getByRole('list', { name: 'Çıkış ve dönüş hava pencereleri' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Çıkış', exact: true })).toHaveValue('12:00');
  await expect(page.getByRole('textbox', { name: 'Dönüş', exact: true })).toHaveValue('15:00');
});
