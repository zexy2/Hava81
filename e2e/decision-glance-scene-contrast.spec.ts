import { expect, test } from '@playwright/test';

// Deterministic weather responses keep CSS contrast checks independent of
// external network latency. Screenshot evidence separately uses the real API.
const now = new Date();
const isoAt = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString();
const observation = {
  cityName: 'İzmir', country: 'TR', temperature: 22, feelsLike: 21, tempMin: 17, tempMax: 28,
  humidity: 48, pressure: 1016, visibility: 10000, windSpeed: 2.5, windDirection: 285,
  description: 'açık', icon: '01n', sunrise: isoAt(-10), sunset: isoAt(-3),
  timestamp: isoAt(0), coordinates: {lat: 38.42, lon: 27.13}, clouds: 3,
  meta: { provider: 'OpenWeather', fetchedAt: now.toISOString(), timezoneOffsetSeconds: 10800, cacheStatus: 'MISS', freshForSeconds: 60 },
};
const daily = [{ date: new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10),
  tempMin: 17, tempMax: 28, icon: '01n', description: 'açık', pop: 0 }];
const hourly = Array.from({length: 24}, (_,i) => ({
  time: isoAt(i + 1), temp: 22 - i/4, icon: i < 7 ? '01n' : '01d',
  description: 'açık', pop: 0, windSpeed: 2.5, precipitationMm: 0,
}));
const forecast = {daily, hourly, meta: {
  provider: 'Open-Meteo', fetchedAt: now.toISOString(), timezoneOffsetSeconds: 10800,
  intervalHours: 1, cacheStatus: 'MISS', freshForSeconds: 300,
}};
test.beforeEach(async ({page}) => {
  await page.route('**/api/v1/weather/current**', route => route.fulfill({json: observation}));
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({json: forecast}));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({json: forecast}));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({json: {
    aqi: 2, aqiLabel: 'Orta', pm25: 8, pm10: 13, o3: 42,
    meta: {provider:'OpenWeather',fetchedAt:now.toISOString(),cacheStatus:'MISS',freshForSeconds:120},
  }}));
});

const contrastRatio = (a: [number, number, number], b: [number, number, number]) => {
  const luminance = ([r, g, blue]: [number, number, number]) => {
    const channels = [r, g, blue].map(value => {
      const normalized = value / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
};

const requiredScenarios = [
  { scene: 'cloud', night: 'false' },
  { scene: 'rain', night: 'false' },
  { scene: 'snow', night: 'false' },
  { scene: 'mist', night: 'false' },
  { scene: 'clear', night: 'true' },
  { scene: 'rain', night: 'true' },
] as const;

test('premium weather scenes retain readable white-on-navy guidance in light theme', async ({ page }) => {
  await page.goto('/izmir/');
  const hero = page.getByTestId('decision-glance');
  await expect(hero).toBeVisible();

  // Exercise CSS states only; the fixtures do not modify application logic.
  await page.locator('.app').evaluate(element => element.setAttribute('data-color-mode', 'light'));

  for (const scenario of requiredScenarios) {
    await hero.evaluate((element, attributes) => {
      element.setAttribute('data-weather-scene', attributes.scene);
      element.setAttribute('data-night', attributes.night);
    }, scenario);

    const styles = await hero.evaluate(element => {
      const message = element.querySelector('.decision-glance__message');
      const computedHero = getComputedStyle(element);
      const computedMessage = getComputedStyle(message!);
      const linearStart = computedHero.backgroundImage.match(
        /linear-gradient\([^,]+,\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/
      );
      return {
        gradient: computedHero.backgroundImage,
        color: computedMessage.color,
        start: linearStart
          ? ([Number(linearStart[1]), Number(linearStart[2]), Number(linearStart[3])] as [number, number, number])
          : null,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });

    expect(styles.start, `Missing scene gradient for ${scenario.scene}/night=${scenario.night}`).not.toBeNull();
    expect(styles.color).toBe('rgb(255, 255, 255)');
    expect(contrastRatio(styles.start!, [255, 255, 255]), `Text contrast: ${scenario.scene}/night=${scenario.night}`).toBeGreaterThanOrEqual(7);
    expect(styles.horizontalOverflow).toBe(false);
  }
});

test('night decision artwork remains subdued at 200% enlarged text', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile text zoom regression');
  await page.goto('/izmir/');
  const hero = page.getByTestId('decision-glance');
  await expect(hero).toBeVisible();
  await hero.evaluate(element => element.setAttribute('data-night', 'true'));
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const value = await hero.locator('.decision-glance__atmosphere').evaluate(element => ({
    opacity: Number(getComputedStyle(element).opacity),
    heroWidth: element.closest('.decision-glance')?.getBoundingClientRect().width ?? 0,
    pageScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(value.opacity).toBeLessThanOrEqual(0.15);
  expect(value.heroWidth).toBeLessThanOrEqual(390);
  expect(value.pageScrollWidth).toBeLessThanOrEqual(value.viewportWidth + 1);
});
