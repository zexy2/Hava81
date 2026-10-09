import { expect, test } from '@playwright/test';

const now = Date.now();
const atHour = (offset: number) => new Date(now + offset * 60 * 60_000).toISOString();
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
  sunrise: atHour(-6),
  sunset: atHour(6),
  timestamp: atHour(0),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 5,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date().toISOString(),
    timezoneOffsetSeconds: 10800,
    cacheStatus: 'MISS',
    freshForSeconds: 300,
  },
};

const forecast = {
  daily: [{ date: localDate, tempMin: 19, tempMax: 27, icon: '01d', description: 'açık', pop: 10 }],
  hourly: Array.from({ length: 24 }, (_, index) => ({
    time: atHour(index),
    temp: 23 - Math.floor(index / 6),
    icon: index < 3 ? '01d' : '02n',
    description: index < 3 ? 'açık' : 'çoğunlukla açık',
    pop: index === 4 ? 45 : 10,
    precipitationMm: index === 4 ? 0.2 : 0,
    windSpeed: 3 + index * 0.05,
  })),
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date().toISOString(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 1,
    cacheStatus: 'MISS',
    freshForSeconds: 300,
  },
};

const airQuality = {
  aqi: 2,
  aqiLabel: 'Orta',
  pm25: 9,
  pm10: 14,
  o3: 42,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date().toISOString(),
    cacheStatus: 'MISS',
    freshForSeconds: 300,
  },
};

const context = {
  provider: 'Open-Meteo',
  fetchedAt: new Date().toISOString(),
  attribution: 'Open-Meteo · CC BY 4.0',
  uvIndexMax: 7.1,
  dustMax: 12,
  grassPollenMax: 4,
  olivePollenMax: 1,
  units: {
    dust: 'μg/m³',
    grassPollen: 'grains/m³',
    olivePollen: 'grains/m³',
    waveHeight: 'm',
    seaSurfaceTemperature: '°C',
  },
  marine: { observedAt: new Date().toISOString(), waveHeight: 0.3, seaSurfaceTemperature: 24.8 },
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ json: airQuality }));
  await page.route('**/api/v1/weather/context**', route => route.fulfill({ json: context }));
  await page.route('**/api/v1/weather/route**', route =>
    route.fulfill({ status: 400, json: { error: 'not used by environment rail test' } })
  );
});

test('environment rail functional labels stay readable without clipping on small screens', async ({ page }) => {
  await page.goto('/istanbul/');
  const rail = page.locator('.environment-rail');
  await expect(rail).toBeVisible();
  await expect(rail.locator('.environment-rail__module')).toHaveCount(4);

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate(themeMode => {
      const key = 'user-settings';
      const previous = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      localStorage.setItem(key, JSON.stringify({ ...previous, themeMode, language: 'tr' }));
    }, theme);
    await page.reload();
    await expect(page.locator('.app')).toHaveAttribute('data-color-mode', theme);

    for (const width of [320, 360, 390, 428]) {
      await page.setViewportSize({ width, height: 844 });
      for (const textScale of ['100%', '200%'] as const) {
        await page.evaluate(scale => { document.documentElement.style.fontSize = scale; }, textScale);
        const result = await rail.evaluate(element => {
          const labels = Array.from(element.querySelectorAll<HTMLElement>('.environment-rail__label'));
          const details = Array.from(element.querySelectorAll<HTMLElement>('.environment-rail__detail'));
          const modules = Array.from(element.querySelectorAll<HTMLElement>('.environment-rail__module'));
          const contained = [...labels, ...details].every(node => {
            const card = node.closest<HTMLElement>('.environment-rail__module');
            if (!card) return false;
            const text = node.getBoundingClientRect();
            const bounds = card.getBoundingClientRect();
            return text.left >= bounds.left - 1 && text.right <= bounds.right + 1 &&
              text.top >= bounds.top - 1 && text.bottom <= bounds.bottom + 1;
          });
          return {
            labelSizes: labels.map(node => Number.parseFloat(getComputedStyle(node).fontSize)),
            detailSizes: details.map(node => Number.parseFloat(getComputedStyle(node).fontSize)),
            labelCount: labels.length,
            detailCount: details.length,
            moduleCount: modules.length,
            contentContained: contained,
            pageWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
          };
        });
        expect(result.labelCount, `four labels at ${width}px / ${textScale}`).toBe(4);
        expect(result.detailCount, `four details at ${width}px / ${textScale}`).toBe(4);
        expect(result.moduleCount).toBe(4);
        expect(result.labelSizes.every(size => size >= 13), `labels >=13px at ${width}px / ${textScale}`).toBe(true);
        expect(result.detailSizes.every(size => size >= 13), `details >=13px at ${width}px / ${textScale}`).toBe(true);
        expect(result.contentContained, `text remains inside cards at ${width}px / ${textScale}`).toBe(true);
        expect(result.pageWidth, `no horizontal page overflow at ${width}px / ${textScale}`)
          .toBeLessThanOrEqual(result.viewportWidth);
      }
    }
  }
});
