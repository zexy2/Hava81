import { expect, test } from '@playwright/test';

const now = Date.now();
const iso = (hours = 0) => new Date(now + hours * 60 * 60_000).toISOString();
const localDate = new Date(now + 3 * 60 * 60_000).toISOString().slice(0, 10);

const current = {
  cityName: 'İstanbul', country: 'TR', temperature: 23, feelsLike: 23, tempMin: 19, tempMax: 27,
  humidity: 58, pressure: 1012, visibility: 10000, windSpeed: 4.2, windDirection: 180,
  description: 'açık', icon: '01d', sunrise: iso(-6), sunset: iso(6), timestamp: iso(),
  coordinates: { lat: 41.01, lon: 28.97 }, clouds: 5,
  meta: { provider: 'OpenWeather', fetchedAt: iso(), timezoneOffsetSeconds: 10800, cacheStatus: 'MISS', freshForSeconds: 60 },
};
const hourly = {
  hourly: Array.from({ length: 24 }, (_, index) => ({
    time: iso(index + 1), temp: 22, icon: '01d', description: 'açık', pop: 5,
    precipitationMm: 0, windSpeed: 3, apparentTemperature: 22, humidity: 50,
    uvIndex: 1, visibility: 20000, weatherCode: 1,
  })),
  meta: { provider: 'Open-Meteo', attribution: 'Open-Meteo · CC BY 4.0', sourceUrl: 'https://open-meteo.com/', fetchedAt: iso(), timezoneOffsetSeconds: 10800, intervalHours: 1, cacheStatus: 'MISS', freshForSeconds: 300 },
};
const forecast = {
  daily: [{ date: localDate, tempMin: 19, tempMax: 27, icon: '01d', description: 'açık', pop: 5 }],
  hourly: hourly.hourly.filter((_, index) => index % 3 === 0),
  meta: { provider: 'OpenWeather', fetchedAt: iso(), timezoneOffsetSeconds: 10800, intervalHours: 3, cacheStatus: 'MISS', freshForSeconds: 300 },
};


test('dashboard hero and current weather fit mobile and desktop viewports', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: hourly }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/api/v1/weather/context**', route => route.fulfill({ status: 503, json: {} }));
  for (const [width, height] of [[390, 844], [1280, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/istanbul');
    const hero = page.locator('.decision-glance').first();
    await expect(hero).toBeVisible();
    const city = page.getByText('İstanbul', { exact: true }).first();
    await expect(city).toBeVisible();
    const geometry = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      hero: document.querySelector('.decision-glance')?.getBoundingClientRect().toJSON(),
    }));
    expect(geometry.scrollWidth, `${width}px document overflow`).toBeLessThanOrEqual(geometry.viewport + 1);
    expect(geometry.hero).toBeTruthy();
    expect(geometry.hero!.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.hero!.right).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}x${height}.png`), fullPage: false });
  }
});

test('forecast loading skeleton resolves to real hourly content on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await page.setViewportSize({ width: 390, height: 844 });
  let releaseForecast!: () => void;
  const pendingForecast = new Promise<void>(resolve => { releaseForecast = resolve; });
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', async route => {
    await pendingForecast;
    await route.fulfill({ json: forecast });
  });
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: hourly }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/api/v1/weather/context**', route => route.fulfill({ status: 503, json: {} }));
  try {
    await page.goto('/istanbul');
    const skeleton = page.locator('.atlas-forecast-loading--card');
    await expect(skeleton).toBeVisible();
    await expect(page.locator('.decision-glance')).toBeVisible();
    const loadingHeight = await skeleton.evaluate(element => element.getBoundingClientRect().height);
    expect(loadingHeight, 'mobile forecast placeholder should be compact').toBeLessThanOrEqual(320);
    await page.screenshot({ path: testInfo.outputPath('forecast-mobile-loading.png') });
    releaseForecast();
    await expect(skeleton).toHaveCount(0, { timeout: 15000 });
    const loaded = page.locator('.hava81-forecast-atlas');
    await expect(loaded).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(391);
    await page.screenshot({ path: testInfo.outputPath('forecast-mobile-loaded.png') });
  } finally {
    releaseForecast();
  }
});


test('mobile forecast failure retains the loading card footprint', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await page.setViewportSize({ width: 390, height: 844 });
  let releaseFailure!: () => void;
  const pendingFailure = new Promise<void>(resolve => { releaseFailure = resolve; });
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', async route => {
    await pendingFailure;
    await route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Temporarily unavailable' } } });
  });
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/api/v1/weather/context**', route => route.fulfill({ status: 503, json: {} }));
  try {
    await page.goto('/istanbul');
    const skeleton = page.locator('.atlas-forecast-loading--card');
    await expect(skeleton).toBeVisible();
    const before = await skeleton.boundingBox();
    releaseFailure();
    const failure = page.locator('.atlas-forecast-error-card');
    await expect(failure).toBeVisible();
    const after = await failure.boundingBox();
    expect(after!.height).toBeGreaterThanOrEqual(before!.height - 1);
    expect(after!.height).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    await page.screenshot({ path: testInfo.outputPath('forecast-mobile-error.png') });
  } finally {
    releaseFailure();
  }
});
