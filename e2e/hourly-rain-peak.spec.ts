import { expect, test } from '@playwright/test';

const fixedNow = new Date('2026-08-29T20:30:00.000Z');
const nowIso = fixedNow.toISOString();
const iso = (hours = 0) => new Date(fixedNow.getTime() + hours * 60 * 60 * 1000).toISOString();
const meta = {
  provider: 'Open-Meteo',
  attribution: 'Open-Meteo · CC BY 4.0 · CAMS',
  sourceUrl: 'https://open-meteo.com/',
  fetchedAt: nowIso,
  timezoneOffsetSeconds: 0,
  intervalHours: 1,
  cacheStatus: 'MISS',
  freshForSeconds: 7200,
};
const current = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 23,
  feelsLike: 24,
  tempMin: 19,
  tempMax: 27,
  humidity: 62,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 3.1,
  windDirection: 160,
  description: 'parçalı bulutlu',
  icon: '02d',
  sunrise: iso(-8),
  sunset: iso(4),
  timestamp: nowIso,
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 35,
  meta: { ...meta, provider: 'OpenWeather' },
};
const hourly = Array.from({ length: 24 }, (_, index) => {
  const time = new Date(Date.parse('2026-08-29T20:00:00.000Z') + index * 60 * 60 * 1000);
  const isPeak = time.toISOString() === '2026-08-29T21:00:00.000Z';
  return {
    time: time.toISOString(),
    temp: 19 + Math.round(5 * Math.sin(index / 6)),
    icon: isPeak ? '10d' : '02d',
    description: isPeak ? 'yağmurlu' : 'parçalı bulutlu',
    pop: isPeak ? 0.8 : 0,
    precipitationMm: isPeak ? 2.4 : 0,
    windSpeed: 3.1,
    apparentTemperature: 20,
    humidity: 62,
    uvIndex: 1,
    visibility: 10000,
    weatherCode: isPeak ? 61 : 2,
  };
});
const forecast = {
  daily: [],
  hourly: hourly.filter((_, index) => index % 3 === 0),
  meta: { ...meta, provider: 'OpenWeather', intervalHours: 3 },
};

test('hourly precipitation summary names the local day and time of the rain peak', async ({ page }, testInfo) => {
  await page.clock.install({ time: fixedNow });
  if (testInfo.project.name === 'mobile-390') {
    await page.setViewportSize({ width: 320, height: 800 });
  }
  // Match production's current API contract: the bundle endpoint is not deployed yet,
  // so return its explicit 404 and exercise the supported single-endpoint fallback.
  await page.route('**/api/v1/weather/bundle**', route =>
    route.fulfill({
      status: 404,
      json: {
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: 'İstenen API rotası bulunamadı.',
          requestId: 'e2e',
        },
      },
    })
  );
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/hourly**', route =>
    route.fulfill({ json: { hourly, meta } })
  );
  await page.route('**/api/v1/weather/air-quality**', route =>
    route.fulfill({ status: 503, json: {} })
  );
  await page.route('**/api/v1/weather/context**', route =>
    route.fulfill({ status: 503, json: {} })
  );

  await page.goto('/istanbul');
  await expect(page.locator('.hava81-forecast-atlas')).toBeVisible();
  const rain = page.locator('.hava81-forecast-atlas__summary-item.is-precipitation');
  await expect(rain).toHaveClass(/has-signal/);
  await expect(rain.locator('.hava81-forecast-atlas__summary-note')).toHaveText('Bugün · 21:00');
  const viewportWidth = page.viewportSize()?.width ?? testInfo.project.use.viewport!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    viewportWidth + 1
  );
});
