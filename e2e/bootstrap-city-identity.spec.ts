import { expect, test } from '@playwright/test';

const englishCachedCurrent = {
  cityName: 'Istanbul',
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
  description: 'clear sky',
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
    cacheStatus: 'HIT',
    freshForSeconds: 60,
  },
};

test('localized cached city identity suppresses the static bootstrap request', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser bootstrap identity coverage');

  // Keep the cached sample fresh at test execution time. The timestamp is
  // provider observation time, so an old fixed fixture must trigger a refresh.
  const sampleTime = Date.now();
  const cachedCurrent = {
    ...englishCachedCurrent,
    sunrise: new Date(sampleTime - 6 * 60 * 60_000).toISOString(),
    sunset: new Date(sampleTime + 4 * 60 * 60_000).toISOString(),
    timestamp: new Date(sampleTime).toISOString(),
    meta: {
      ...englishCachedCurrent.meta,
      fetchedAt: new Date(sampleTime).toISOString(),
      freshForSeconds: 300,
    },
  };

  await page.addInitScript(cachedWeather => {
    window.localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'metric',
        windSpeedUnit: 'ms',
        themeMode: 'auto',
        language: 'en',
      })
    );
    window.localStorage.setItem(
      'weather_cache',
      JSON.stringify({ data: cachedWeather, timestamp: Date.now(), language: 'en' })
    );
  }, cachedCurrent);

  let currentRequests = 0;
  await page.route('**/api/v1/weather/current**', route => {
    currentRequests += 1;
    return route.fulfill({ json: cachedCurrent });
  });

  await page.goto('/istanbul');
  // Display the canonical Turkish province label even with English provider data.
  // The decorative location dot is included in the heading's accessible name.
  const cityHeading = page.getByRole('heading', { name: /İstanbul$/, level: 1 });
  await expect(cityHeading).toBeVisible();
  await expect(cityHeading).toContainText('İstanbul');
  expect(currentRequests).toBe(0);
});
