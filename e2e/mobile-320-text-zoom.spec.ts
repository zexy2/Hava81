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


// WCAG 1.4.4 / 1.4.10: smallest supported phone with enlarged UI text.
// Capture the failed state as a Playwright artifact for visual review.
test('320px navigation remains operable with 200% text in both languages', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'Run once on the mobile Chromium project');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: hourly }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }));
  await page.route('**/api/v1/weather/context**', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }));
  await page.goto('/istanbul');
  await page.locator('html').evaluate(element => { element.style.fontSize = '200%'; });
  for (const themeMode of ['light', 'dark'] as const) {
  for (const lang of ['tr', 'en'] as const) {
    await page.evaluate(({ language, themeMode }) => {
      const currentSettings = JSON.parse(localStorage.getItem('user-settings') || '{}');
      localStorage.setItem('user-settings', JSON.stringify({ ...currentSettings, language, themeMode }));
    }, { language: lang, themeMode });
    await page.reload();
    await page.locator('html').evaluate(element => { element.style.fontSize = '200%'; });
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('.app')).toHaveAttribute('data-color-mode', themeMode);
    const nav = page.locator('.atlas-bottom-nav');
    await expect(nav).toBeVisible();
    const buttons = nav.locator('button');
    await expect(buttons).toHaveCount(3);
    const measurements = await buttons.evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      const label = element.querySelector('.atlas-bottom-nav__label');
      const labelRect = label?.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        labelFits: !!labelRect && labelRect.left >= rect.left - 1 && labelRect.right <= rect.right + 1,
      };
    }));
    await page.screenshot({ path: testInfo.outputPath(`nav-320-zoom200-${lang}-${themeMode}.png`), fullPage: false });
    expect(measurements, `${lang} navigation button geometry`).toEqual(
      expect.arrayContaining([expect.objectContaining({ labelFits: true })]),
    );
    for (const item of measurements) {
      expect(item.width, `${lang} touch width`).toBeGreaterThanOrEqual(44);
      expect(item.height, `${lang} touch height`).toBeGreaterThanOrEqual(44);
      expect(item.left, `${lang} left bound`).toBeGreaterThanOrEqual(-1);
      expect(item.right, `${lang} right bound`).toBeLessThanOrEqual(321);
      expect(item.labelFits, `${lang} label must fit its button`).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  }
  }
});
