import { expect, test } from '@playwright/test';

const fixtureNow = Date.now();
const fixtureIsoAtHour = (offsetHours: number) =>
  new Date(fixtureNow + offsetHours * 60 * 60_000).toISOString();

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
  daily: [],
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

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
});

test('tablet decision alerts wrap instead of clipping at 200% text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single tablet text-resize regression');

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/istanbul/');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  const panel = page.locator('.decision-alerts');
  await expect(panel).toBeVisible();

  const layout = await panel.evaluate(element => {
    const copy = element.firstElementChild?.getBoundingClientRect();
    const button = element.querySelector('button')?.getBoundingClientRect();
    const panelRect = element.getBoundingClientRect();
    if (!copy || !button) throw new Error('Missing decision alert content');

    return {
      viewportWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      panelClientWidth: element.clientWidth,
      panelScrollWidth: element.scrollWidth,
      panelLeft: panelRect.left,
      panelRight: panelRect.right,
      copyLeft: copy.left,
      copyRight: copy.right,
      copyTop: copy.top,
      copyBottom: copy.bottom,
      buttonLeft: button.left,
      buttonRight: button.right,
      buttonTop: button.top,
      buttonBottom: button.bottom,
      buttonHeight: button.height,
    };
  });

  expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.panelScrollWidth).toBeLessThanOrEqual(layout.panelClientWidth + 1);
  expect(layout.panelLeft).toBeGreaterThanOrEqual(-1);
  expect(layout.panelRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.copyRight).toBeLessThanOrEqual(layout.panelRight + 1);
  expect(layout.buttonLeft).toBeGreaterThanOrEqual(layout.panelLeft - 1);
  expect(layout.buttonRight).toBeLessThanOrEqual(layout.panelRight + 1);
  expect(layout.buttonHeight).toBeGreaterThanOrEqual(44);
  expect(layout.buttonTop).toBeGreaterThanOrEqual(layout.copyBottom - 1);
});
