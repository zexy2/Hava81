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

const forecast = {
  daily: [{ date: localDate, tempMin: 19, tempMax: 27, icon: '01d', description: 'açık', pop: 10 }],
  hourly: [{ time: iso(1), temp: 23, icon: '01d', description: 'açık', pop: 10, windSpeed: 4 }],
  meta: {
    provider: 'OpenWeather',
    fetchedAt: iso(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 3,
    cacheStatus: 'MISS',
    freshForSeconds: 300,
  },
};

const routeDeparture = new Date();
const routeDurationMinutes = 331;
const routeResult = {
  kind: 'corridor-estimate',
  estimatedDistanceKm: 413,
  estimatedDurationMinutes: routeDurationMinutes,
  requestedDeparture: routeDeparture.toISOString(),
  score: 84,
  segments: [0, 0.25, 0.5, 0.75, 1].map((fraction, index) => ({
    fraction,
    lat: 41 - index * 0.25,
    lon: 29 + index * 0.9,
    eta: new Date(routeDeparture.getTime() + routeDurationMinutes * 60_000 * fraction).toISOString(),
    temperature: 22 + index,
    precipitationProbability: 5,
    windSpeed: 4 + index,
    description: 'açık',
    score: 88,
    risk: 'low',
  })),
  disclaimer: 'Bu sonuç gerçek yol/navigasyon rotası değildir.',
};

test('route result header stays inside the page at 200% text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop route text-resize regression');

  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }));
  await page.route('**/api/v1/weather/context**', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }));
  await page.route('**/api/v1/weather/route**', route => route.fulfill({ json: routeResult }));

  await page.goto('/istanbul');
  await page.getByText('Rota havası', { exact: true }).click();
  await page.getByRole('button', { name: /koridoru kontrol et/i }).click();
  await expect(page.getByRole('heading', { name: /İstanbul → Ankara/i })).toBeVisible();

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const header = page.locator('.route-weather__announcement > header');
  await header.scrollIntoViewIfNeeded();
  const layout = await header.evaluate(element => {
    const fits = (node: Element) => {
      const html = node as HTMLElement;
      return html.scrollWidth <= html.clientWidth + 1;
    };
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      headerFits: fits(element),
      childrenFit: Array.from(element.children).every(fits),
    };
  });

  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.headerFits).toBe(true);
  expect(layout.childrenFit).toBe(true);
});
