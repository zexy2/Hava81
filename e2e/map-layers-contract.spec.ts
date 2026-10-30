/**
 * Design contract for the map layers: precipitation, temperature, wind and cloud, drawn
 * from our own 81-province data, with a time scrubber and a layer-aware legend.
 *
 * FROZEN: written before the feature and not edited afterwards. If a check is wrong, raise
 * it with the owner instead of changing it. Province data is fixed per test.
 */
import type { Locator, Page } from '@playwright/test';
import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import { mockMapTiles, overrideApiJson, seedSettings } from './helpers/weather-fixtures';

test.use({ bypassCSP: true });

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

const PROVINCES = [
  {
    plate: 34,
    name: 'İstanbul',
    lat: 41.01,
    lon: 28.98,
    temperature: 16,
    pop: 70,
    mm: 2.4,
    cloud: 90,
    dir: 180,
    wind: 6,
  },
  {
    plate: 6,
    name: 'Ankara',
    lat: 39.93,
    lon: 32.86,
    temperature: 11,
    pop: 10,
    mm: 0,
    cloud: 30,
    dir: 270,
    wind: 3,
  },
  {
    plate: 35,
    name: 'İzmir',
    lat: 38.42,
    lon: 27.14,
    temperature: 21,
    pop: 5,
    mm: 0,
    cloud: 20,
    dir: 0,
    wind: 4,
  },
  {
    plate: 7,
    name: 'Antalya',
    lat: 36.9,
    lon: 30.7,
    temperature: 24,
    pop: 0,
    mm: 0,
    cloud: 5,
    dir: 90,
    wind: 2,
  },
  {
    plate: 61,
    name: 'Trabzon',
    lat: 41.0,
    lon: 39.72,
    temperature: 14,
    pop: 85,
    mm: 6,
    cloud: 100,
    dir: 315,
    wind: 5,
  },
  {
    plate: 25,
    name: 'Erzurum',
    lat: 39.9,
    lon: 41.27,
    temperature: 3,
    pop: 40,
    mm: 0.8,
    cloud: 70,
    dir: 45,
    wind: 7,
  },
  {
    plate: 27,
    name: 'Gaziantep',
    lat: 37.07,
    lon: 37.38,
    temperature: 19,
    pop: 0,
    mm: 0,
    cloud: 10,
    dir: 225,
    wind: 3,
  },
  {
    plate: 21,
    name: 'Diyarbakır',
    lat: 37.91,
    lon: 40.24,
    temperature: 17,
    pop: 0,
    mm: 0,
    cloud: 0,
    dir: 135,
    wind: 2,
  },
  {
    plate: 42,
    name: 'Konya',
    lat: 37.87,
    lon: 32.48,
    temperature: 12,
    pop: 15,
    mm: 0,
    cloud: 40,
    dir: 300,
    wind: 4,
  },
  {
    plate: 55,
    name: 'Samsun',
    lat: 41.29,
    lon: 36.33,
    temperature: 15,
    pop: 60,
    mm: 1.5,
    cloud: 80,
    dir: 330,
    wind: 5,
  },
];

async function mockLayerData(page: Page) {
  const observedAt = new Date(Date.now() - 10 * 60_000).toISOString();
  await overrideApiJson(page, 'provinces', {
    provinces: PROVINCES.map(province => ({
      plate: province.plate,
      name: province.name,
      lat: province.lat,
      lon: province.lon,
      temperature: province.temperature,
      weatherCode: province.pop > 50 ? 61 : 3,
      icon: province.pop > 50 ? '10d' : '03d',
      description: province.pop > 50 ? 'yağmurlu' : 'bulutlu',
      windSpeed: province.wind,
      windDirection: province.dir,
      cloudCover: province.cloud,
      precipitation: province.mm,
      precipitationProbability: province.pop,
      outlook: [
        {
          hourOffset: 3,
          precipitationProbability: Math.max(0, 100 - province.pop),
          precipitation: 0,
          temperature: province.temperature + 2,
        },
        {
          hourOffset: 6,
          precipitationProbability: 50,
          precipitation: 0.5,
          temperature: province.temperature - 1,
        },
      ],
      observedAt,
    })),
    meta: {
      provider: 'Open-Meteo',
      attribution: 'Open-Meteo · CC BY 4.0',
      fetchedAt: new Date().toISOString(),
      units: 'metric',
      total: PROVINCES.length,
    },
  });
}

async function openMap(page: Page, path = '/istanbul/?view=map') {
  await mockMapTiles(page);
  await mockLayerData(page);
  await page.goto(path);
  const map = page.locator('[data-map-surface]');
  await expect(map).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
  return map;
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value, 'element has a layout box').not.toBeNull();
  return value!;
}

const layers = (page: Page) => page.getByRole('group', { name: /Harita katmanı|Map layer/i });
const times = (page: Page) => page.getByRole('group', { name: /Zaman|Time/i });
const field = (page: Page) => page.locator('img[data-map-layer]');

test.describe('map layers contract', () => {
  test('four layers, one active, precipitation first', DESKTOP, async ({ page }) => {
    await openMap(page);
    const group = layers(page);
    await expect(group).toBeVisible();
    for (const name of ['Yağış', 'Sıcaklık', 'Rüzgâr', 'Bulut']) {
      await expect(group.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(group.locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect(group.getByRole('button', { name: 'Yağış', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test(
    'the field layer is drawn from our data and follows the chosen layer',
    DESKTOP,
    async ({ page }) => {
      await openMap(page);
      await expect(field(page)).toHaveCount(1, { timeout: 10_000 });
      await expect(field(page)).toHaveAttribute('data-map-layer', 'precipitation');
      const rainSource = await field(page).getAttribute('src');
      expect(rainSource, 'a locally drawn image').toMatch(/^(data:image|blob:)/);
      await layers(page).getByRole('button', { name: 'Sıcaklık', exact: true }).click();
      await expect(field(page)).toHaveAttribute('data-map-layer', 'temperature');
      expect(await field(page).getAttribute('src')).not.toBe(rainSource);
      await layers(page).getByRole('button', { name: 'Bulut', exact: true }).click();
      await expect(field(page)).toHaveAttribute('data-map-layer', 'cloud');
    }
  );

  test('the legend speaks the active layer', DESKTOP, async ({ page }) => {
    await openMap(page);
    const legend = page.locator('.weather-map__legend');
    await expect(legend).toHaveAttribute('data-layer', 'precipitation');
    await expect(legend).toContainText('%');
    await layers(page).getByRole('button', { name: 'Sıcaklık', exact: true }).click();
    await expect(legend).toHaveAttribute('data-layer', 'temperature');
    await expect(legend).toContainText('°');
    await layers(page).getByRole('button', { name: 'Rüzgâr', exact: true }).click();
    await expect(legend).toHaveAttribute('data-layer', 'wind');
    await expect(legend).toContainText('m/s');
  });

  test(
    'the time scrubber moves precipitation through the next hours',
    DESKTOP,
    async ({ page }) => {
      await openMap(page);
      const scrubber = times(page);
      await expect(scrubber).toBeVisible();
      const steps = scrubber.getByRole('button');
      await expect(steps).toHaveCount(3);
      await expect(steps.nth(0)).toHaveAttribute('aria-pressed', 'true');
      await expect(steps.nth(0)).toHaveText(/Şimdi/);
      await expect(steps.nth(1)).toHaveText(/\+3/);
      await expect(steps.nth(2)).toHaveText(/\+6/);
      await expect(field(page)).toHaveCount(1, { timeout: 10_000 });
      const now = await field(page).getAttribute('src');
      await steps.nth(1).click();
      await expect(steps.nth(1)).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => field(page).getAttribute('src')).not.toBe(now);
      // Wind and cloud are current readings only.
      await layers(page).getByRole('button', { name: 'Rüzgâr', exact: true }).click();
      await expect(times(page)).toBeHidden();
    }
  );

  test('wind arrows point where each reported wind blows', DESKTOP, async ({ page }) => {
    await openMap(page, '/istanbul/?view=map');
    await layers(page).getByRole('button', { name: 'Rüzgâr', exact: true }).click();
    const arrows = page.locator('[data-wind-province]');
    await expect(arrows.first()).toBeVisible({ timeout: 10_000 });
    expect(await arrows.count()).toBe(PROVINCES.length);
    // Meteorological direction is where wind comes FROM; the arrow points downwind.
    const istanbul = page.locator('[data-wind-province="34"]');
    await expect(istanbul).toHaveAttribute('data-rotation', '0');
    const trabzon = page.locator('[data-wind-province="61"]');
    await expect(trabzon).toHaveAttribute('data-rotation', '135');
  });

  test("the city's popup reads the active layer value", DESKTOP, async ({ page }) => {
    await openMap(page);
    await page.locator('.weather-map__marker').first().click();
    const popup = page.locator('[data-map-popup]');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('%70');
    await page.keyboard.press('Escape');
    await layers(page).getByRole('button', { name: 'Bulut', exact: true }).click();
    await page.locator('.weather-map__marker').first().click();
    await expect(page.locator('[data-map-popup]')).toContainText('%90');
  });

  test('layers degrade quietly when province data is missing', DESKTOP, async ({ page }) => {
    await mockMapTiles(page);
    await overrideApiJson(page, 'provinces', { statusCode: 404, message: 'Route not found' }, 404);
    await page.goto('/istanbul/?view=map');
    await expect(page.locator('[data-map-surface]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Katman verisi şu an yok|Layer data is unavailable/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(field(page)).toHaveCount(0);
    await expect(page.locator('.weather-map__marker').first()).toBeVisible();
  });

  test('reduced motion keeps the layers still', DESKTOP, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMap(page);
    await layers(page).getByRole('button', { name: 'Rüzgâr', exact: true }).click();
    await page.waitForTimeout(400);
    const running = await page
      .locator('#weather-map-region')
      .evaluate(
        region =>
          region
            .getAnimations({ subtree: true })
            .filter(animation => animation.playState === 'running').length
      );
    expect(running).toBe(0);
  });

  test('layer controls pass axe in light and dark', DESKTOP, async ({ page }) => {
    for (const themeMode of ['light', 'dark'] as const) {
      await seedSettings(page, { themeMode });
      await openMap(page);
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const failures = await page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: {
              run: (
                context: unknown,
                options: unknown
              ) => Promise<{
                violations: Array<{ id: string; nodes: Array<{ target: string[] }> }>;
              }>;
            };
          }
        ).axe;
        const result = await axe.run(
          { include: [['#weather-map-region']] },
          {
            runOnly: {
              type: 'tag',
              values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'],
            },
          }
        );
        return result.violations.flatMap(violation =>
          violation.nodes.map(node => `${violation.id} — ${node.target.join(', ')}`)
        );
      });
      expect(failures, `${themeMode} theme`).toEqual([]);
    }
  });

  test.describe('on a touch phone', () => {
    test.use({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      userAgent: IPHONE_UA,
    });

    test(
      'layer and time controls sit on the map, clear of the bottom bar, as 44px targets',
      MOBILE,
      async ({ page }) => {
        const map = await openMap(page, '/izmir/?view=map');
        const mapBox = await box(map);
        const navBox = await box(page.locator('.atlas-bottom-nav'));
        for (const group of [layers(page), times(page)]) {
          const groupBox = await box(group);
          expect(groupBox.x).toBeGreaterThanOrEqual(mapBox.x - 1);
          expect(groupBox.x + groupBox.width).toBeLessThanOrEqual(mapBox.x + mapBox.width + 1);
          expect(groupBox.y).toBeGreaterThanOrEqual(mapBox.y - 1);
          expect(groupBox.y + groupBox.height, 'clear of the bottom bar').toBeLessThanOrEqual(
            navBox.y
          );
          const buttons = await group.getByRole('button').evaluateAll(elements =>
            elements.map(element => {
              const rect = element.getBoundingClientRect();
              return Math.min(rect.width, rect.height);
            })
          );
          for (const size of buttons) expect(size).toBeGreaterThanOrEqual(44);
        }
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scroll).toBeLessThanOrEqual(390);
      }
    );
  });
});
