import { DESKTOP, MOBILE, TABLET, expect, test } from './helpers/test';
import {
  expectSelectedStateDistinct,
  expectVisibleFocusRing,
  findUndersizedTargets,
} from './helpers/layout';
import { TWO_FAVORITES, seedFavorites } from './helpers/weather-fixtures';

// Cross-cutting accessibility gates: target size, contrast, forced colors, focus visibility.

test.describe('target size', () => {
  test('mobile interactive controls are at least 44px', MOBILE, async ({ page }) => {
    await page.goto('/istanbul');
    await expect(
      page.locator('.hava81-forecast-atlas__source').getByRole('link', { name: 'Open-Meteo' })
    ).toBeVisible();
    expect(await findUndersizedTargets(page.locator('body'))).toEqual([]);

    // Planla (?view=plan) holds the context signals, plan, activity and route controls.
    await page.goto('/istanbul/?view=plan');
    await expect(
      page.locator('.context-signals__source').getByRole('link', { name: 'Open-Meteo' })
    ).toBeVisible();
    await expect(page.locator('.activity-planner__chips button').first()).toBeVisible();
    expect(await findUndersizedTargets(page.locator('body'))).toEqual([]);
  });

  test(
    'tablet forecast sources and interval controls are at least 44px',
    TABLET,
    async ({ page }) => {
      await page.goto('/istanbul');
      await expect(page.locator('.hava81-forecast-atlas__source').getByRole('link')).toHaveCount(2);
      expect(await findUndersizedTargets(page.locator('.hava81-forecast-atlas__source'))).toEqual(
        []
      );
      await expect(
        page.getByRole('group', { name: 'Gösterim aralığı' }).getByRole('button')
      ).toHaveCount(7);
      expect(
        await findUndersizedTargets(page.getByRole('group', { name: 'Gösterim aralığı' }))
      ).toEqual([]);
    }
  );
});

test.describe('contrast', () => {
  // axe-core is injected as an inline script (addScriptTag), which the page CSP
  // (scripts/apply-csp.mjs) blocks; bypass CSP only for this audit.
  test.use({ bypassCSP: true });

  test(
    'dashboard text contrast meets WCAG AA in light and dark themes',
    DESKTOP,
    async ({ page }) => {
      for (const [width, language, themeMode] of [
        [320, 'tr', 'light'],
        [390, 'en', 'light'],
        [1440, 'tr', 'light'],
        [390, 'tr', 'dark'],
      ] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/izmir/');
        await page.evaluate(
          ({ language, themeMode }) => {
            localStorage.setItem(
              'user-settings',
              JSON.stringify({
                temperatureUnit: 'metric',
                windSpeedUnit: 'ms',
                language,
                themeMode,
              })
            );
          },
          { language, themeMode }
        );
        for (const view of ['today', 'plan'] as const) {
          await page.goto(view === 'plan' ? '/izmir/?view=plan' : '/izmir/');
          await expect(
            page.locator(view === 'plan' ? '.daily-plan__decision' : '.decision-glance__score')
          ).toBeVisible();
          await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
          const failures = await page.evaluate(async () => {
            const axe = (
              window as unknown as Window & {
                axe: {
                  run: (
                    root: Document,
                    options: unknown
                  ) => Promise<{
                    violations: Array<{ id: string; nodes: Array<{ target: string[] }> }>;
                  }>;
                };
              }
            ).axe;
            const result = await axe.run(document, {
              runOnly: { type: 'rule', values: ['color-contrast'] },
            });
            return result.violations.flatMap(violation =>
              violation.nodes.map(node => `${violation.id}: ${node.target.join(', ')}`)
            );
          });
          expect(
            failures,
            `text contrast at ${width}px (${language}, ${themeMode}, ${view})`
          ).toEqual([]);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
          ).toBe(true);
        }
      }
    }
  );
});

test.describe('forced colors', () => {
  test('selected and pressed states stay distinguishable on mobile', MOBILE, async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/istanbul');

    await expectSelectedStateDistinct(
      page.locator('.hava81-forecast-atlas__range-button[aria-pressed="true"]'),
      page.locator('.hava81-forecast-atlas__range-button[aria-pressed="false"]').first(),
      'forecast interval'
    );
    await expectSelectedStateDistinct(
      page.locator('.atlas-bottom-nav__button[aria-current="page"]'),
      page.locator('.atlas-bottom-nav__button:not([aria-current])').first(),
      'bottom navigation'
    );
    await page.locator('.atlas-bottom-nav').getByRole('button', { name: 'Planla' }).click();
    await expectSelectedStateDistinct(
      page.locator('.activity-planner__chips button[aria-pressed="true"]').first(),
      page.locator('.activity-planner__chips button[aria-pressed="false"]').first(),
      'activity choice'
    );

    const favorite = page
      .locator('.atlas-icon-button[aria-pressed]')
      .filter({ has: page.locator('svg') })
      .first();
    await expect(favorite).toHaveAttribute('aria-pressed', 'false');
    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');
    await expectSelectedStateDistinct(
      favorite,
      page.locator('.atlas-icon-button--search'),
      'pressed header action'
    );

    await page.locator('.atlas-settings-button').click();
    await expectSelectedStateDistinct(
      page.locator('.settings-option[aria-pressed="true"]').first(),
      page.locator('.settings-option[aria-pressed="false"]').first(),
      'settings option'
    );
  });

  test(
    'active saved city and search suggestion stay distinguishable on desktop',
    DESKTOP,
    async ({ page }) => {
      await seedFavorites(page, TWO_FAVORITES);
      await page.emulateMedia({ forcedColors: 'active' });
      await page.goto('/istanbul');

      await expectSelectedStateDistinct(
        page.locator('.city-tabs__tab[aria-current="location"]'),
        page.locator('.city-tabs__tab:not([aria-current])').first(),
        'saved city'
      );

      const input = page.locator('.search-bar__input');
      await input.fill('is');
      await expect(page.locator('.search-bar__suggestion').first()).toBeVisible();
      await input.press('ArrowDown');
      const selected = page.locator('.search-bar__suggestion[aria-selected="true"]');
      await expect(input).toHaveAttribute(
        'aria-activedescendant',
        (await selected.getAttribute('id')) ?? ''
      );
      await expectSelectedStateDistinct(
        selected,
        page.locator('.search-bar__suggestion[aria-selected="false"]').first(),
        'search suggestion'
      );
    }
  );
});

test.describe('keyboard focus', () => {
  test(
    'skip link moves keyboard focus into the main weather content',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/istanbul');
      await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

      await page.keyboard.press('Tab');
      const skipLink = page.getByRole('link', { name: 'İçeriğe Geç' });
      await expect(skipLink).toBeFocused();

      await page.keyboard.press('Enter');
      await expect(page.locator('#main-content')).toBeFocused();
    }
  );

  test(
    'focus rings inside scroll rails and clipped cards are drawn inward',
    MOBILE,
    async ({ page }) => {
      await page.goto('/istanbul');
      for (const control of [
        page.locator('.hava81-forecast-atlas__range-button').first(),
        page.locator('.environment-rail__module--action'),
      ]) {
        await control.scrollIntoViewIfNeeded();
        await expectVisibleFocusRing(control, { insideClippingRail: true });
      }
      await page.goto('/istanbul/?view=plan');
      const chip = page.locator('.activity-planner__chips button').first();
      await chip.scrollIntoViewIfNeeded();
      await expectVisibleFocusRing(chip, { insideClippingRail: true });
    }
  );
});
