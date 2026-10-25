import type { Page } from '@playwright/test';
import { DESKTOP, expect, test } from './helpers/test';
import { ensureForecastAtlasLoaded } from './helpers/forecast';
import {
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectReadable,
  expectTextNotClipped,
  expectWithinViewportWidth,
  setTextScale,
  setWidth,
} from './helpers/layout';
import { overrideApi, overrideApiJson, seedSettings } from './helpers/weather-fixtures';

/**
 * WCAG 1.4.4 / 1.4.10: with 200% text every dashboard section reflows instead
 * of clipping, at phone, tablet and desktop widths.
 *
 * This single table replaces ~40 hand-written "… reflows at 200 percent text
 * size" tests from the old smoke file, which each re-measured scrollWidth on a
 * hand-picked list of child selectors and asserted exact row/column counts.
 * Viewports are set explicitly, so the table runs once (desktop project).
 */
type ReflowCase = {
  name: string;
  region: string;
  widths: number[];
  language?: 'tr' | 'en';
  /** Optional interaction before measuring (e.g. open a disclosure). */
  prepare?: (page: Page) => Promise<void>;
  /** Air quality and context providers unavailable (degraded data path). */
  degraded?: boolean;
  /** Known, documented gaps per width (selector skipped by the clipping check). */
  knownGaps?: Record<number, string>;
  /** Region lives in the secondary Planla view (`?view=plan`, Faz 2.3). */
  plan?: boolean;
};

const openRoute = async (page: Page) => {
  await page.getByText('Rota havası', { exact: true }).click();
  await expect(page.locator('.route-weather__form')).toBeVisible();
};

const CASES: ReflowCase[] = [
  {
    name: 'decision field',
    region: '.hava81-decision-field',
    widths: [320, 768, 1280],
  },
  {
    name: 'forecast summary',
    region: '.hava81-forecast-atlas__summary',
    widths: [320, 390, 1024, 1280],
  },
  { name: 'environment rail', region: '.environment-rail', widths: [320, 768, 1440] },
  { name: 'Planla entry', region: '.atlas-plan-entry', widths: [320, 768, 1280] },
  {
    name: 'Planla header',
    region: '.atlas-plan-view__header',
    widths: [320, 768, 1280],
    plan: true,
  },
  {
    name: 'Planla header (English)',
    region: '.atlas-plan-view__header',
    widths: [320, 768],
    language: 'en',
    plan: true,
  },
  { name: 'daily plan', region: '.daily-plan', widths: [320, 390, 768, 1024, 1280], plan: true },
  {
    name: 'daily plan (English)',
    region: '.daily-plan',
    widths: [768, 1024, 1280],
    language: 'en',
    plan: true,
  },
  { name: 'commute plan', region: '.commute-plan', widths: [320, 1024], plan: true },
  {
    name: 'activity planner',
    region: '.activity-planner',
    widths: [320, 768, 1280],
    plan: true,
  },
  {
    name: 'activity planner (air/context unavailable)',
    region: '.activity-planner',
    widths: [390],
    degraded: true,
    plan: true,
  },
  {
    name: 'activity planner (English)',
    region: '.activity-planner',
    widths: [768],
    language: 'en',
    plan: true,
  },
  {
    name: 'decision alerts',
    region: '.decision-alerts',
    widths: [320, 390, 768],
    plan: true,
  },
  { name: 'context signals', region: '.context-signals', widths: [320, 390], plan: true },
  {
    name: 'route form',
    region: '.route-weather__form',
    widths: [320, 1024],
    prepare: openRoute,
    plan: true,
  },
];

test.describe('200% text reflow', () => {
  for (const { name, region, widths, language, prepare, knownGaps, degraded, plan } of CASES) {
    test(
      `${name} stays readable at 200% text (${widths.join(', ')}px)`,
      DESKTOP,
      async ({ page }) => {
        if (language) await seedSettings(page, { language });
        if (degraded) {
          await overrideApiJson(page, 'air', { error: { code: 'UNAVAILABLE' } }, 503);
          await overrideApiJson(page, 'context', { error: { code: 'UNAVAILABLE' } }, 503);
        }
        await setWidth(page, widths[0], 900);
        await page.goto(plan ? '/istanbul/?view=plan' : '/istanbul');
        if (region.startsWith('.hava81-forecast-atlas')) await ensureForecastAtlasLoaded(page);
        await expect(
          page.locator(plan ? '.atlas-plan-view__header h1' : '.hava81-decision-field__city')
        ).toBeVisible();
        if (prepare) await prepare(page);
        await expect(page.locator(region)).toBeVisible();
        await setTextScale(page, 200);
        for (const width of widths) {
          await setWidth(page, width, 900);
          await expectReadable(
            page,
            page.locator(region),
            `${name} at ${width}px/200%`,
            knownGaps?.[width]
          );
        }
      }
    );
  }

  test(
    'the whole page never scrolls sideways from 320px to 1280px at 100% and 200% text',
    DESKTOP,
    async ({ page }) => {
      await setWidth(page, 320, 700);
      await page.goto('/istanbul');
      await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
      await expectWithinViewportWidth(page.locator('.atlas-dashboard__primary'), '320px dashboard');
      for (const view of ['today', 'plan'] as const) {
        if (view === 'plan') {
          await setTextScale(page, 100);
          await setWidth(page, 1280, 900);
          await page.getByRole('button', { name: /Planla’yı aç/ }).click();
          await expect(page.locator('.atlas-plan-view .daily-plan')).toBeVisible();
        }
        for (const width of [320, 390, 768, 1024, 1280]) {
          await setWidth(page, width, 900);
          for (const scale of [100, 200] as const) {
            await setTextScale(page, scale);
            await expectNoHorizontalScroll(page, `${view} ${width}px/${scale}%`);
          }
        }
      }
    }
  );

  test(
    'environment metric icons never cover their labels, values or details',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/istanbul/');
      const modules = page.locator('.environment-rail .environment-rail__module');
      await expect(modules).toHaveCount(4);
      for (const width of [320, 390, 768, 1440]) {
        await setWidth(page, width, 900);
        for (const scale of [100, 200] as const) {
          await setTextScale(page, scale);
          for (const module of await modules.all()) {
            const icon = module.locator('.environment-rail__icon');
            for (const part of ['label', 'value', 'detail']) {
              await expectNoOverlap(
                icon,
                module.locator(`.environment-rail__${part}`),
                `icon vs ${part} at ${width}px/${scale}%`
              );
            }
          }
          await expectNoHorizontalScroll(page, `${width}px/${scale}%`);
        }
      }
    }
  );

  test('route corridor result stays readable at 200% text', DESKTOP, async ({ page }) => {
    await page.goto('/istanbul/?view=plan');
    await openRoute(page);
    await page.getByRole('button', { name: /koridoru kontrol et/i }).click();
    await expect(page.getByRole('heading', { name: /İstanbul → Ankara/i })).toBeVisible();
    await setTextScale(page, 200);
    for (const width of [1280, 390]) {
      await setWidth(page, width, 900);
      await expectReadable(
        page,
        page.locator('.route-weather__announcement > header'),
        `route result header at ${width}px/200%`
      );
    }
  });

  test('loading shell stays inside the viewport at 200% text', DESKTOP, async ({ page }) => {
    let releaseCurrent!: () => void;
    const currentGate = new Promise<void>(resolve => {
      releaseCurrent = resolve;
    });
    await overrideApi(page, 'current', async route => {
      await currentGate;
      await route.abort();
    });
    try {
      await page.goto('/istanbul/');
      await setTextScale(page, 200);
      const loading = page.locator('.atlas-loading');
      await expect(loading).toBeVisible();
      await expectWithinViewportWidth(loading, 'loading shell');
      for (const part of ['.atlas-loading__decision', '.atlas-loading__forecast']) {
        await expectWithinViewportWidth(loading.locator(part), part);
      }
      await expectTextNotClipped(loading, 'loading shell');
      await expectNoHorizontalScroll(page, 'loading shell');
    } finally {
      releaseCurrent();
    }
  });
});
