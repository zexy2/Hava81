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


test('landscape phone dock stays compact and in viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await page.setViewportSize({ width: 640, height: 360 });
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: hourly }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/api/v1/weather/context**', route => route.fulfill({ status: 503, json: {} }));
  await page.goto('/istanbul');
  const dock = page.locator('.atlas-bottom-nav');
  await expect(dock).toBeVisible();
  const rect = await dock.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.height).toBeLessThanOrEqual(65);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(360);
  const buttons = dock.locator('button');
  await expect(buttons).toHaveCount(3);
  for (const button of await buttons.all()) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: testInfo.outputPath('landscape-640x360-dock.png') });
});


test('landscape phone navigation remains usable at 200% text in both languages', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await page.setViewportSize({ width: 640, height: 360 });
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: hourly }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/api/v1/weather/context**', route => route.fulfill({ status: 503, json: {} }));
  await page.goto('/istanbul');
  for (const language of ['tr', 'en'] as const) {
    await page.evaluate(language => {
      const settings = JSON.parse(localStorage.getItem('user-settings') || '{}');
      localStorage.setItem('user-settings', JSON.stringify({ ...settings, language }));
    }, language);
    await page.reload();
    await page.locator('html').evaluate(element => { element.style.fontSize = '200%'; });
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    const dock = page.locator('.atlas-bottom-nav');
    await expect(dock).toBeVisible();
    const bounds = await dock.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeLessThanOrEqual(96);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(361);
    for (const button of await dock.locator('button').all()) {
      const rect = await button.boundingBox();
      expect(rect!.height).toBeGreaterThanOrEqual(44);
      expect(rect!.width).toBeGreaterThanOrEqual(44);
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(641);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(641);
    await page.screenshot({ path: testInfo.outputPath(`landscape-zoom200-${language}.png`) });
  }
});
