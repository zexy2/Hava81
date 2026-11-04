/**
 * The footer sits on the living sky with no box, so its type must follow the sky, not only
 * the theme: in the light theme the sky turns dark at night, and the footer must turn light
 * with it. Dusk is warm and still light, so the footer keeps its dark type there. (Contrast on the real composited sky was checked by eye in both phases; the
 * sky is a canvas over a CSS gradient, so its pixels are not sampled here.)
 */
import type { Page } from '@playwright/test';
import { DESKTOP, expect, test } from './helpers/test';
import { fixtures, overrideApiJson, seedSettings } from './helpers/weather-fixtures';

// 30 Oct 2026 in İstanbul (UTC+3): sunrise 07:32, sunset 18:02.
const NIGHT = new Date('2026-10-30T20:30:00Z'); // 23:30
const DAY = new Date('2026-10-30T09:30:00Z'); // 12:30
const DUSK = new Date('2026-10-30T15:20:00Z'); // 18:20, just after sunset
const SUNRISE = '2026-10-30T04:32:00Z';
const SUNSET = '2026-10-30T15:02:00Z';

const luminance = (css: string) => {
  const [red, green, blue] = (css.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
};

async function openAt(page: Page, now: Date) {
  await page.clock.setFixedTime(now);
  await seedSettings(page, { themeMode: 'light' });
  await overrideApiJson(page, 'current', {
    ...fixtures.current,
    sunrise: SUNRISE,
    sunset: SUNSET,
    timestamp: now.toISOString(),
    meta: { ...fixtures.current.meta, fetchedAt: now.toISOString() },
  });
  await page.goto('/istanbul/');
  const footer = page.getByTestId('app-footer');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toBeVisible();
  return footer;
}

const colourOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate(el => getComputedStyle(el).color);

test.describe('footer on the living sky', () => {
  test(
    'light theme at night: footer type, accent and logo turn light',
    DESKTOP,
    async ({ page }) => {
      await openAt(page, NIGHT);
      await expect(page.locator('.app')).toHaveAttribute('data-color-mode', 'light');
      await expect(page.locator('.app')).toHaveAttribute('data-sky-phase', 'night');

      expect(luminance(await colourOf(page, '.atlas-footer__tagline'))).toBeGreaterThan(0.7);
      expect(luminance(await colourOf(page, '.atlas-footer__credits a'))).toBeGreaterThan(0.7);
      expect(luminance(await colourOf(page, '.atlas-footer__wordmark em'))).toBeGreaterThan(0.45);
      // OpenWeather's negative (light-on-dark) logo replaces the dark one.
      await expect(page.locator('.atlas-footer .data-credit__logo--dark')).toBeVisible();
      await expect(page.locator('.atlas-footer .data-credit__logo--light')).toBeHidden();
    }
  );

  test(
    'light theme by day keeps dark footer type and the regular logo',
    DESKTOP,
    async ({ page }) => {
      await openAt(page, DAY);
      await expect(page.locator('.app')).toHaveAttribute('data-sky-phase', 'day');

      expect(luminance(await colourOf(page, '.atlas-footer__tagline'))).toBeLessThan(0.1);
      expect(luminance(await colourOf(page, '.atlas-footer__credits a'))).toBeLessThan(0.1);
      await expect(page.locator('.atlas-footer .data-credit__logo--light')).toBeVisible();
      await expect(page.locator('.atlas-footer .data-credit__logo--dark')).toBeHidden();
    }
  );

  test(
    'light theme at dusk keeps dark type on the warm, still-light sky',
    DESKTOP,
    async ({ page }) => {
      await openAt(page, DUSK);
      await expect(page.locator('.app')).toHaveAttribute('data-sky-phase', 'dusk');
      expect(luminance(await colourOf(page, '.atlas-footer__tagline'))).toBeLessThan(0.1);
    }
  );
});
