import { expect, test } from '@playwright/test';

const current = {
  cityName: 'İstanbul', country: 'TR', temperature: 23, feelsLike: 23, tempMin: 19, tempMax: 27,
  humidity: 58, pressure: 1012, visibility: 10000, windSpeed: 4.2, windDirection: 180,
  description: 'açık', icon: '01d', sunrise: '2026-08-28T03:20:00.000Z', sunset: '2026-08-28T16:35:00.000Z',
  timestamp: '2026-08-28T09:00:00.000Z', coordinates: { lat: 41.01, lon: 28.97 }, clouds: 5,
  meta: { provider: 'OpenWeather', fetchedAt: new Date().toISOString(), timezoneOffsetSeconds: 10800, cacheStatus: 'MISS', freshForSeconds: 60 },
};
const forecast = {
  daily: [{ date: '2026-08-28', tempMin: 19, tempMax: 27, icon: '01d', description: 'açık', pop: 10 }],
  hourly: [
    { time: '2026-08-28T09:00:00.000Z', temp: 23, icon: '01d', description: 'açık', pop: 10, windSpeed: 4 },
    { time: '2026-08-28T12:00:00.000Z', temp: 26, icon: '01d', description: 'açık', pop: 5, windSpeed: 5 },
  ],
  meta: { provider: 'OpenWeather', fetchedAt: new Date().toISOString(), timezoneOffsetSeconds: 10800, intervalHours: 3, cacheStatus: 'MISS', freshForSeconds: 300 },
};
const air = { aqi: 2, aqiLabel: 'Orta', pm25: 9, pm10: 14, o3: 42, meta: { provider: 'OpenWeather', fetchedAt: new Date().toISOString(), cacheStatus: 'MISS', freshForSeconds: 120 } };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ json: air }));
});

test('core city experience renders and uses a shareable city URL', async ({ page }) => {
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
  await expect(page).toHaveURL(/\/istanbul$/);
  await expect(page.getByText(/OpenWeather/)).toBeVisible();
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
