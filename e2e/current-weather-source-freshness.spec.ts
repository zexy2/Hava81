import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import { fixtures, overrideApiJson, seedSettings } from './helpers/weather-fixtures';

function staleSourceWithFreshRetrieval() {
  const fetchedAt = new Date();
  const observedAt = new Date(fetchedAt.getTime() - 3 * 60 * 60_000).toISOString();
  return {
    ...fixtures.current,
    timestamp: observedAt,
    meta: {
      ...fixtures.current.meta,
      fetchedAt: fetchedAt.toISOString(),
      freshForSeconds: 300,
    },
  };
}

function previousLocalDaylightWithFreshRetrieval() {
  const fetchedAt = new Date();
  const timezoneOffsetMs = fixtures.current.meta.timezoneOffsetSeconds * 1000;
  const localNow = new Date(fetchedAt.getTime() + timezoneOffsetMs);
  const currentLocalMidnightUtc =
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()) -
    timezoneOffsetMs;
  const previousLocalMidnightUtc = currentLocalMidnightUtc - 24 * 60 * 60_000;
  return {
    ...fixtures.current,
    sunrise: new Date(previousLocalMidnightUtc + 6 * 60 * 60_000).toISOString(),
    sunset: new Date(previousLocalMidnightUtc + 19.5 * 60 * 60_000).toISOString(),
    timestamp: fetchedAt.toISOString(),
    meta: {
      ...fixtures.current.meta,
      fetchedAt: fetchedAt.toISOString(),
      freshForSeconds: 3600,
    },
  };
}

test('fresh retrieval metadata cannot make an old current-weather sample look fresh on mobile', MOBILE, async ({ page }) => {
  await overrideApiJson(page, 'current', staleSourceWithFreshRetrieval());
  await page.goto('/istanbul/');

  await expect(page.locator('.hava81-decision-field__atlas-meta')).toContainText('Eski veri');
  await expect(page.locator('.hava81-decision-field__current [role="status"]')).toContainText(
    'Anlık veri güncel değil'
  );
  await expect(page.locator('.hava81-decision-field__temperature-value')).toHaveCount(0);
});

test('English city page explains a stale source sample even when it was fetched moments ago', DESKTOP, async ({ page }) => {
  await seedSettings(page, { language: 'en' });
  await overrideApiJson(page, 'current', staleSourceWithFreshRetrieval());
  await page.goto('/en/istanbul/');

  await expect(page.locator('.hava81-decision-field__atlas-meta')).toContainText('Outdated observation');
  await expect(page.locator('.hava81-decision-field__current [role="status"]')).toContainText(
    'Current observation is not fresh'
  );
  await expect(page.locator('.hava81-decision-field__temperature-value')).toHaveCount(0);
});


test("Turkish city page does not present yesterday's sunrise and sunset as current", DESKTOP, async ({ page }) => {
  await overrideApiJson(page, 'current', previousLocalDaylightWithFreshRetrieval());
  await page.goto('/istanbul/');

  const daylight = page.locator('.environment-rail__module').first();
  await expect(daylight.getByRole('status')).toHaveText('Gün doğuşu ve batış bilgisi güncel değil');
  await expect(daylight.locator('time')).toHaveCount(0);
});

test("English city page labels yesterday's sunrise and sunset as outdated", DESKTOP, async ({ page }) => {
  await seedSettings(page, { language: 'en' });
  await overrideApiJson(page, 'current', previousLocalDaylightWithFreshRetrieval());
  await page.goto('/en/istanbul/');

  const daylight = page.locator('.environment-rail__module').first();
  await expect(daylight.getByRole('status')).toHaveText('Sunrise and sunset times are outdated');
  await expect(daylight.locator('time')).toHaveCount(0);
});
