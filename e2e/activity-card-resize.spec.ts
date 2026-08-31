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

test('activity cards stay inside a 390px page at 200% text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile activity-card text-resize regression');
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: hourly }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }));
  await page.route('**/api/v1/weather/context**', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }));

  await page.goto('/istanbul');
  await page.locator('html').evaluate(element => { element.style.fontSize = '200%'; });
  const cards = page.locator('.activity-planner__cards');
  await cards.scrollIntoViewIfNeeded();
  await expect(cards.locator('.activity-card')).toHaveCount(2);

  const layout = await cards.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    cardsFit: Array.from(element.children).every(child => {
      const box = child.getBoundingClientRect();
      const html = child as HTMLElement;
      return box.left >= 0 && box.right <= document.documentElement.clientWidth + 1 && html.scrollWidth <= html.clientWidth + 1;
    }),
    offenders: Array.from(element.querySelectorAll<HTMLElement>('*'))
      .map(node => {
        const card = node.closest('.activity-card')?.getBoundingClientRect();
        const box = node.getBoundingClientRect();
        return { className: node.className, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, left: box.left, right: box.right, cardRight: card?.right ?? 0, text: node.textContent?.slice(0, 80) };
      })
      .filter(node => node.scrollWidth > node.clientWidth + 1 || node.right > node.cardRight + 1),
  }));
  console.log(JSON.stringify(layout));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.cardsFit).toBe(true);
});
