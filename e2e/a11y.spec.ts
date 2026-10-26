import { DESKTOP, MOBILE, TABLET, expect, test } from './helpers/test';
import { ensureForecastAtlasLoaded } from './helpers/forecast';
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
    await ensureForecastAtlasLoaded(page);
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
    'forecast interval targets remain at least 44px at 320px with 200% text',
    DESKTOP,
    async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 900 });
      await page.goto('/');

      const variants = [
        { path: '/izmir/', language: 'tr', themeMode: 'light' },
        { path: '/sanliurfa/', language: 'tr', themeMode: 'dark' },
        { path: '/en/izmir/', language: 'en', themeMode: 'light' },
        { path: '/en/sanliurfa/', language: 'en', themeMode: 'dark' },
      ] as const;

      for (const variant of variants) {
        await page.evaluate(value => {
          localStorage.setItem(
            'user-settings',
            JSON.stringify({
              temperatureUnit: 'metric',
              windSpeedUnit: 'ms',
              language: value.language,
              themeMode: value.themeMode,
            })
          );
        }, variant);
        await page.goto(variant.path);
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        await ensureForecastAtlasLoaded(page);

        const buttons = page.locator('.hava81-forecast-atlas__range-button');
        await expect(buttons).toHaveCount(7);
        const sizes = await buttons.evaluateAll(elements =>
          elements.map(element => {
            const rect = element.getBoundingClientRect();
            return {
              label: element.getAttribute('aria-label') || element.textContent?.trim() || 'interval',
              width: rect.width,
              height: rect.height,
            };
          })
        );
        for (const size of sizes) {
          expect(size.width, variant.path + ' ' + size.label + ' width').toBeGreaterThanOrEqual(44);
          expect(size.height, variant.path + ' ' + size.label + ' height').toBeGreaterThanOrEqual(44);
        }

        const layout = await page.evaluate(() => ({
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        }));
        expect(
          layout.documentWidth,
          variant.path + ' must not overflow at 320px / 200% text'
        ).toBeLessThanOrEqual(layout.viewportWidth);
      }
    }
  );

  test(
    'context-signal attribution links meet the 24px desktop target size',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/istanbul/?view=plan');
      const links = page.locator('.context-signals__source').getByRole('link');
      await expect(links).toHaveCount(2);
      await expect(links.nth(0)).toBeVisible();
      const sizes = await links.evaluateAll(elements =>
        elements.map(element => {
          const rect = element.getBoundingClientRect();
          return {
            label: element.textContent?.trim() || element.tagName,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
      );
      for (const size of sizes) {
        expect(size.width, size.label + ' target width').toBeGreaterThanOrEqual(24);
        expect(size.height, size.label + ' target height').toBeGreaterThanOrEqual(24);
      }
    }
  );

  test(
    'tablet forecast sources and interval controls are at least 44px',
    TABLET,
    async ({ page }) => {
      await page.goto('/istanbul');
      await ensureForecastAtlasLoaded(page);
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
    'dashboard has no axe WCAG A/AA or best-practice violations in light and dark themes',
    DESKTOP,
    async ({ page }) => {
      for (const [width, language, themeMode] of [
        [320, 'tr', 'light'],
        [320, 'en', 'dark'],
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
                    violations: Array<{
                      id: string;
                      impact: string | null;
                      help: string;
                      nodes: Array<{ target: string[] }>;
                    }>;
                  }>;
                };
              }
            ).axe;
            const result = await axe.run(document, {
              runOnly: {
                type: 'tag',
                values: [
                  'wcag2a',
                  'wcag2aa',
                  'wcag21a',
                  'wcag21aa',
                  'wcag22aa',
                  'best-practice',
                ],
              },
            });
            return result.violations.flatMap(violation =>
              violation.nodes.map(
                node =>
                  `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help} — ${node.target.join(', ')}`
              )
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

  test(
    'dashboard reflows at 200% root text size on a 320px English dark viewport',
    DESKTOP,
    async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 900 });
      await page.addInitScript(() => {
        localStorage.setItem(
          'user-settings',
          JSON.stringify({
            temperatureUnit: 'metric',
            windSpeedUnit: 'ms',
            language: 'en',
            themeMode: 'dark',
          })
        );
      });

      for (const view of ['today', 'plan'] as const) {
        await page.goto(view === 'plan' ? '/izmir/?view=plan' : '/izmir/');
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        await expect(
          page.locator(view === 'plan' ? '.daily-plan__decision' : '.decision-glance__score')
        ).toBeVisible();

        const layout = await page.evaluate(() => ({
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          rootFontSize: getComputedStyle(document.documentElement).fontSize,
        }));
        expect(Number.parseFloat(layout.rootFontSize)).toBeGreaterThan(16);
        expect(layout.documentWidth, `${view} document must not overflow at 200% text size`).toBeLessThanOrEqual(
          layout.viewportWidth
        );
        expect(layout.bodyWidth, `${view} body must not overflow at 200% text size`).toBeLessThanOrEqual(
          layout.viewportWidth
        );
      }
    }
  );
});

test.describe('forced colors', () => {
  test('selected and pressed states stay distinguishable on mobile', MOBILE, async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/istanbul');
    await ensureForecastAtlasLoaded(page);

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
      await ensureForecastAtlasLoaded(page);
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
