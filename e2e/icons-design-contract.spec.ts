/**
 * Design contract for the Atlas weather symbol set.
 *
 * FROZEN: written before the redesign and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it. Data is fixed per test.
 */
import type { Locator, Page } from '@playwright/test';
import { DESKTOP, expect, test } from './helpers/test';
import { ensureForecastAtlasLoaded } from './helpers/forecast';
import { fixtures, overrideApiJson, seedSettings } from './helpers/weather-fixtures';

test.use({ bypassCSP: true });

const { localDate } = fixtures;
const NOW = Date.now();
const iso = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

/** One hour per symbol, in this order; the rest of the day is overcast. */
const CODES = ['01d', '02d', '03d', '04d', '09d', '10d', '11d', '13d', '50d', '01n', '02n', '10n'];
const HOURLY = Array.from({ length: 24 }, (_, index) => ({
  time: iso(index),
  temp: 15,
  icon: CODES[index] ?? '04d',
  description: 'durum',
  pop: 0,
  precipitationMm: 0,
  windSpeed: 3,
}));
const DAILY = [
  { date: localDate(0), tempMin: 12, tempMax: 20, icon: '04d', description: 'kapalı', pop: 0 },
  { date: localDate(1), tempMin: 13, tempMax: 19, icon: '10d', description: 'yağmurlu', pop: 60, precipitationMm: 4 },
  { date: localDate(2), tempMin: 14, tempMax: 21, icon: '01d', description: 'açık', pop: 0 },
  { date: localDate(3), tempMin: 15, tempMax: 18, icon: '11d', description: 'fırtına', pop: 80, precipitationMm: 12 },
  { date: localDate(4), tempMin: 10, tempMax: 16, icon: '13d', description: 'karlı', pop: 50 },
];

async function openForecast(page: Page) {
  // The current observation keeps the first hour's code, so hour 0 shows 01d.
  await overrideApiJson(page, 'current', { ...fixtures.current, icon: '01d' });
  await overrideApiJson(page, 'forecast', { ...fixtures.forecast, daily: DAILY });
  await overrideApiJson(page, 'hourly', { ...fixtures.hourlyForecast, hourly: HOURLY, daily: DAILY });
  await page.goto('/istanbul/');
  await ensureForecastAtlasLoaded(page);
  const atlas = page.locator('.hava81-forecast-atlas').first();
  await atlas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  return atlas;
}

const hourSymbol = (atlas: Locator, index: number) =>
  atlas.locator('.hava81-forecast-atlas__hour').nth(index).locator('svg.hava81-weather-symbol');

/** Computed paint of a part: its fill unless none/transparent, otherwise its stroke. */
const partColor = (symbol: Locator, part: string) =>
  symbol.locator(`[data-part="${part}"]`).first().evaluate(element => {
    const style = getComputedStyle(element);
    const fill = style.fill;
    const paint = fill && fill !== 'none' && !fill.includes('rgba(0, 0, 0, 0)') ? fill : style.stroke;
    const [r, g, b] = (paint.match(/[\d.]+/g) ?? ['0', '0', '0']).map(Number);
    return { r, g, b };
  });

test.describe('weather symbol contract', () => {
  test('every weather code has its own drawing', DESKTOP, async ({ page }) => {
    const atlas = await openForecast(page);
    const drawings = new Set<string>();
    for (let index = 0; index < CODES.length; index += 1) {
      const symbol = hourSymbol(atlas, index);
      await expect(symbol).toHaveAttribute('data-weather-code', CODES[index]);
      drawings.add(await symbol.evaluate(element => element.innerHTML.replace(/<title>.*?<\/title>/, '')));
    }
    expect(drawings.size).toBe(CODES.length);
  });

  test('elements are colour-coded: amber sun, blue rain, saffron bolt, filled cloud', DESKTOP, async ({ page }) => {
    for (const themeMode of ['light', 'dark'] as const) {
      await seedSettings(page, { themeMode });
      const atlas = await openForecast(page);
      const sun = await partColor(hourSymbol(atlas, 0), 'sun');
      expect(sun.r, `${themeMode} sun is warm`).toBeGreaterThan(sun.b + 60);
      expect(sun.g, `${themeMode} sun is amber, not red`).toBeGreaterThan(sun.b);
      const drop = await partColor(hourSymbol(atlas, 5), 'drop');
      expect(drop.b, `${themeMode} rain is blue`).toBeGreaterThan(drop.r + 40);
      const bolt = await partColor(hourSymbol(atlas, 6), 'bolt');
      expect(bolt.r, `${themeMode} bolt is saffron`).toBeGreaterThan(bolt.b + 80);
      expect(bolt.g, `${themeMode} bolt is saffron`).toBeGreaterThan(bolt.b + 40);
      const cloudFill = await hourSymbol(atlas, 2)
        .locator('[data-part="cloud"]')
        .first()
        .evaluate(element => getComputedStyle(element).fill);
      expect(cloudFill, `${themeMode} cloud is two-tone`).not.toMatch(/^none$|rgba\(0, 0, 0, 0\)/);
    }
  });

  test('night codes draw a moon, never a sun', DESKTOP, async ({ page }) => {
    const atlas = await openForecast(page);
    for (const index of [9, 10, 11]) {
      await expect(hourSymbol(atlas, index).locator('[data-part="moon"]')).toHaveCount(1);
      await expect(hourSymbol(atlas, index).locator('[data-part="sun"]')).toHaveCount(0);
    }
    await expect(hourSymbol(atlas, 1).locator('[data-part="sun"]')).toHaveCount(1);
  });

  test('intensity reads from the drawing: showers carry more drops than rain', DESKTOP, async ({ page }) => {
    const atlas = await openForecast(page);
    const shower = await hourSymbol(atlas, 4).locator('[data-part="drop"]').count();
    const rain = await hourSymbol(atlas, 5).locator('[data-part="drop"]').count();
    expect(rain).toBeGreaterThanOrEqual(2);
    expect(shower).toBeGreaterThan(rain);
    await expect(hourSymbol(atlas, 7).locator('[data-part="flake"]')).not.toHaveCount(0);
    await expect(hourSymbol(atlas, 2).locator('[data-part="drop"]')).toHaveCount(0);
  });

  test('detail follows size: one cloud in the hour strip, layered clouds in the week', DESKTOP, async ({ page }) => {
    const atlas = await openForecast(page);
    await expect(hourSymbol(atlas, 3).locator('[data-part="cloud"]')).toHaveCount(1);
    const daySymbol = atlas.locator('.hava81-forecast-atlas__day').first().locator('svg.hava81-weather-symbol');
    expect(await daySymbol.locator('[data-part="cloud"]').count()).toBeGreaterThanOrEqual(2);
  });

  test('only the current hour moves', DESKTOP, async ({ page }) => {
    const atlas = await openForecast(page);
    const running = await atlas.locator('svg.hava81-weather-symbol').evaluateAll(symbols =>
      symbols.map(symbol =>
        symbol.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length
      )
    );
    const current = await atlas
      .locator('.hava81-forecast-atlas__hour.is-current svg.hava81-weather-symbol')
      .evaluate(symbol => symbol.getAnimations({ subtree: true }).length);
    expect(current, 'current hour symbol is alive').toBeGreaterThan(0);
    expect(running.filter(count => count > 0).length, 'symbols in motion').toBe(1);
  });

  test('reduced motion keeps every symbol still', DESKTOP, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const atlas = await openForecast(page);
    const moving = await atlas.locator('svg.hava81-weather-symbol').evaluateAll(
      symbols =>
        symbols.filter(symbol =>
          symbol.getAnimations({ subtree: true }).some(animation => animation.playState === 'running')
        ).length
    );
    expect(moving).toBe(0);
  });

  test('symbols are named for assistive tech and pass axe in both themes', DESKTOP, async ({ page }) => {
    for (const themeMode of ['light', 'dark'] as const) {
      await seedSettings(page, { themeMode });
      const atlas = await openForecast(page);
      await expect(hourSymbol(atlas, 1)).toHaveAttribute('role', 'img');
      await expect(hourSymbol(atlas, 1)).toHaveAttribute('aria-label', /\S/);
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const failures = await page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: {
              run: (
                context: unknown,
                options: unknown
              ) => Promise<{ violations: Array<{ id: string; nodes: Array<{ target: string[] }> }> }>;
            };
          }
        ).axe;
        const result = await axe.run(
          { include: [['.hava81-forecast-atlas']] },
          { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } }
        );
        return result.violations.flatMap(violation =>
          violation.nodes.map(node => `${violation.id} — ${node.target.join(', ')}`)
        );
      });
      expect(failures, `${themeMode} theme`).toEqual([]);
    }
  });
});
