import { expect, test } from '@playwright/test';

const now = Date.now();
const iso = (hours = 0) => new Date(now + hours * 60 * 60_000).toISOString();
const localDate = new Date(now + 3 * 60 * 60_000).toISOString().slice(0, 10);

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
  sunrise: iso(-6),
  sunset: iso(6),
  timestamp: iso(),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 5,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: iso(),
    timezoneOffsetSeconds: 10800,
    cacheStatus: 'MISS',
    freshForSeconds: 60,
  },
};

const hourly = {
  hourly: Array.from({ length: 24 }, (_, index) => ({
    time: iso(index + 1),
    temp: 22,
    icon: '01d',
    description: 'açık',
    pop: 5,
    precipitationMm: 0,
    windSpeed: 3,
    apparentTemperature: 22,
    humidity: 50,
    uvIndex: 1,
    visibility: 20000,
    weatherCode: 1,
  })),
  meta: {
    provider: 'Open-Meteo',
    attribution: 'Open-Meteo · CC BY 4.0',
    sourceUrl: 'https://open-meteo.com/',
    fetchedAt: iso(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 1,
    cacheStatus: 'MISS',
    freshForSeconds: 300,
  },
};

const forecast = {
  daily: [
    { date: localDate, tempMin: 19, tempMax: 27, icon: '01d', description: 'açık', pop: 5 },
  ],
  hourly: hourly.hourly.filter((_, index) => index % 3 === 0),
  meta: {
    provider: 'OpenWeather',
    fetchedAt: iso(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 3,
    cacheStatus: 'MISS',
    freshForSeconds: 300,
  },
};

test('settings controls stay usable at 390px with 200% text', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile settings text-resize regression');
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: hourly }));
  await page.route('**/api/v1/weather/air-quality**', route =>
    route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } })
  );
  await page.route('**/api/v1/weather/context**', route =>
    route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } })
  );

  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  await page.locator('.atlas-settings-button').click();
  const dialog = page.getByRole('dialog', { name: /ayarlar|settings/i });
  await expect(dialog).toBeVisible();

  const geometry = await dialog.evaluate(element => {
    const panel = element as HTMLElement;
    const panelRect = panel.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const optionGroups = Array.from(panel.querySelectorAll<HTMLElement>('.settings-option-group'));
    const options = Array.from(panel.querySelectorAll<HTMLElement>('.settings-option'));
    const close = panel.querySelector<HTMLElement>('.settings-panel__close');

    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth,
      panelClientWidth: panel.clientWidth,
      panelScrollWidth: panel.scrollWidth,
      panelLeft: panelRect.left,
      panelRight: panelRect.right,
      groupsFit: optionGroups.every(group => group.scrollWidth <= group.clientWidth + 1),
      optionsFit: options.every(option => {
        const rect = option.getBoundingClientRect();
        return (
          option.scrollWidth <= option.clientWidth + 1 &&
          rect.left >= panelRect.left - 1 &&
          rect.right <= panelRect.right + 1
        );
      }),
      closeReachable: close
        ? (() => {
            const rect = close.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return hit === close || close.contains(hit);
          })()
        : false,
    };
  });

  expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.panelScrollWidth).toBeLessThanOrEqual(geometry.panelClientWidth + 1);
  expect(geometry.panelLeft).toBeGreaterThanOrEqual(-1);
  expect(geometry.panelRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.groupsFit).toBe(true);
  expect(geometry.optionsFit).toBe(true);
  expect(geometry.closeReachable).toBe(true);
});
