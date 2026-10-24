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
