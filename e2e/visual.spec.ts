import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { VISUAL, expect, test } from './helpers/test';
import { setWidth } from './helpers/layout';
import {
  VISUAL_FIXED_NOW,
  createWeatherFixtures,
  mockMapTiles,
  mockWeatherApi,
  seedSettings,
} from './helpers/weather-fixtures';

/**
 * A handful of screenshot comparisons that guard the overall look (blue
 * premium design, Faz 2 first-screen composition) instead of hundreds of
 * pixel-exact style assertions.
 *
 * Opt-in: these only run in the `visual` project (`HAVA81_VISUAL=1`), because
 * baselines must be generated on CI Linux, never on a developer machine:
 *
 *   HAVA81_VISUAL=1 npm run e2e -- --project=visual --update-snapshots   # create/refresh baselines
 *   HAVA81_VISUAL=1 npm run e2e -- --project=visual                      # compare
 *
 * The Linux baselines are committed under e2e/visual.spec.ts-snapshots/
 * (`*-visual-linux.png`). To refresh them after an intended visual change, take
 * the `visual-baselines-linux` artifact of the "Visual baselines" workflow
 * (.github/workflows/visual-baseline.yml; it also runs on PRs touching this
 * file), review every PNG and commit it in the same PR.
 *
 * Determinism: fixed browser clock + fixtures anchored to the same instant,
 * local map tiles, animations disabled (playwright.config.ts), web fonts
 * awaited, and freshness metadata masked.
 */

test.use({ mockApi: false });

const VISUAL_CSS = fileURLToPath(new URL('./helpers/visual.css', import.meta.url));

const data = createWeatherFixtures(VISUAL_FIXED_NOW);

async function openCity(page: Page, path = '/istanbul/') {
  await page.clock.setFixedTime(new Date(VISUAL_FIXED_NOW));
  await mockWeatherApi(page, data);
  await mockMapTiles(page);
  await page.goto(path);
  if (path.includes('view=plan')) {
    await expect(page.locator('.atlas-plan-view__header h1')).toBeVisible();
  } else if (!path.includes('view=map')) {
    await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
    await expect(page.locator('.hava81-forecast-atlas')).toBeVisible();
  }
  // Offscreen panels use `content-visibility: auto`; render them for real so full-page
  // captures are not blank and section heights do not jump while scrolling.
  await page.addStyleTag({ content: '* { content-visibility: visible !important; }' });
  await page.evaluate(() => document.fonts.ready);
}

/** Parts whose text depends on wall-clock freshness rather than layout. */
const volatile = (page: Page) => [
  page.locator('.hava81-decision-field__atlas-meta'),
  page.locator('.atlas-forecast-freshness'),
];

test.describe('visual comparisons', VISUAL, () => {
  test('first screen, desktop 1280, light', async ({ page }) => {
    await setWidth(page, 1280, 900);
    await openCity(page);
    await expect(page).toHaveScreenshot('first-screen-desktop-1280-light.png', {
      mask: volatile(page),
    });
  });

  test('first screen, mobile 390, dark', async ({ page }) => {
    await seedSettings(page, { themeMode: 'dark' });
    await setWidth(page, 390, 844);
    await openCity(page);
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
    await expect(page).toHaveScreenshot('first-screen-mobile-390-dark.png', {
      mask: volatile(page),
    });
  });

  test('Planla view, desktop 1280', async ({ page }) => {
    await setWidth(page, 1280, 900);
    await openCity(page, '/istanbul/?view=plan');
    const plan = page.locator('.atlas-plan-view');
    // Planla panels are lazy (Suspense); wait until every one has rendered so the height is stable.
    for (const panel of [
      '.daily-plan',
      '.commute-plan',
      '.activity-planner',
      '.decision-alerts',
      '.context-signals',
      '.route-weather',
    ]) {
      await expect(plan.locator(panel)).toBeVisible();
    }
    await expect(plan.locator('.activity-card')).toHaveCount(2);
    // Capture Planla from its heading down to the route panel. The collapsed route
    // disclosure at the bottom settles its height asynchronously, so it is left out.
    // Wait until the section stops growing (lazy panels, fonts, charts).
    let last = -1;
    await expect
      .poll(
        async () => {
          const height = await plan.evaluate(element =>
            Math.round(element.getBoundingClientRect().height)
          );
          const stable = height === last;
          last = height;
          return stable;
        },
        { intervals: [300, 300, 300, 500, 500, 1000] }
      )
      .toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    const top = await plan.boundingBox();
    const route = await plan.locator('.route-weather').boundingBox();
    await expect(page).toHaveScreenshot('plan-section-desktop-1280.png', {
      fullPage: true,
      clip: {
        x: top!.x,
        y: top!.y + (await page.evaluate(() => window.scrollY)),
        width: top!.width,
        height: route!.y - top!.y,
      },
      mask: volatile(page),
      stylePath: VISUAL_CSS,
    });
  });

  test('map view, mobile 390', async ({ page }) => {
    await setWidth(page, 390, 844);
    await openCity(page, '/istanbul/?view=map');
    const map = page.locator('#weather-map-region');
    await expect(map).toBeVisible();
    await expect(page.locator('.weather-map__tile-status')).toBeHidden({ timeout: 15_000 });
    await expect.poll(() => page.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0);
    await expect(map).toHaveScreenshot('map-view-mobile-390.png', { mask: volatile(page) });
  });
});
