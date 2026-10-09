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


// Keyboard users must be able to reach the compact navigation without a pointer.
test('320px bottom navigation supports visible keyboard focus at 200% text', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: hourly }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }));
  await page.route('**/api/v1/weather/context**', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }));
  await page.goto('/istanbul');
  await page.locator('html').evaluate(element => { element.style.fontSize = '200%'; });
  const buttons = page.locator('.atlas-bottom-nav button');
  await expect(buttons).toHaveCount(3);
  await buttons.nth(0).focus();
  await expect(buttons.nth(0)).toBeFocused();
  await page.keyboard.press('Tab');
  // When the map is disabled, normal browser Tab navigation skips it.
  const mapDisabled = await buttons.nth(1).isDisabled();
  await expect(buttons.nth(mapDisabled ? 2 : 1)).toBeFocused();
  const indicator = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement;
    const styles = getComputedStyle(active);
    return { outlineStyle: styles.outlineStyle, outlineWidth: parseFloat(styles.outlineWidth) };
  });
  expect(indicator.outlineStyle).not.toBe('none');
  expect(indicator.outlineWidth).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('nav-320-keyboard-focus.png') });
});
