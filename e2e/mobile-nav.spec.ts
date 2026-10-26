import { MOBILE, expect, test } from './helpers/test';
import {
  expectBeforeInDom,
  expectContainedIn,
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectTouchTarget,
  setTextScale,
  setWidth,
} from './helpers/layout';
import { seedSettings } from './helpers/weather-fixtures';

// Mobile bottom navigation (dock) and the mobile app shell.

test.describe('mobile bottom navigation', () => {
  test('bottom navigation precedes main content in keyboard order', MOBILE, async ({ page }) => {
    await page.goto('/istanbul');
    const nav = page.locator('.atlas-bottom-nav');
    const main = page.locator('#main-content');
    await expect(nav.locator('button').first()).toBeAttached();
    await expectBeforeInDom(nav, main, 'navigation before main');
    await expectBeforeInDom(
      nav.locator('button').first(),
      main
        .locator(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]'
        )
        .first(),
      'first nav control before first main control'
    );
  });

  for (const language of ['tr', 'en'] as const) {
    test(
      `${language.toUpperCase()} bottom navigation labels stay inside their targets at 100% and 200% text`,
      MOBILE,
      async ({ page }) => {
        if (language === 'en') await seedSettings(page, { language: 'en', themeMode: 'dark' });
        await page.goto('/izmir/');
        const nav = page.locator('.atlas-bottom-nav');
        await expect(nav).toBeVisible();
        const buttons = nav.locator('.atlas-bottom-nav__button');
        if (language === 'en') {
          expect(
            (await nav.locator('.atlas-bottom-nav__label').allTextContents()).map(text =>
              text.trim()
            )
          ).toEqual(['Today', 'Plan', 'Map', 'Compare']);
        }

        for (const width of [280, 320, 390]) {
          await setWidth(page, width, 844);
          for (const scale of [100, 200] as const) {
            await setTextScale(page, scale);
            const at = `${width}px/${scale}%`;
            const count = await buttons.count();
            for (let index = 0; index < count; index += 1) {
              const button = buttons.nth(index);
              const label = button.locator('.atlas-bottom-nav__label');
              await expect(label, `label visible ${at}`).toBeVisible();
              await expectContainedIn(label, button, `label ${index} ${at}`);
              await expectTouchTarget(button, `nav item ${index} ${at}`);
              if (index > 0) {
                await expectNoOverlap(
                  buttons.nth(index - 1).locator('.atlas-bottom-nav__label'),
                  label,
                  `labels ${index - 1}/${index} ${at}`
                );
              }
            }
            if (language === 'en' && width >= 320) {
              // Short English labels never break mid-word ("Comp-are").
              const wrapped = await nav
                .locator('.atlas-bottom-nav__label')
                .evaluateAll(
                  labels =>
                    labels.filter(
                      label =>
                        label.getBoundingClientRect().height >=
                        parseFloat(getComputedStyle(label).lineHeight) * 1.3
                    ).length
                );
              expect(wrapped, `English labels on one line ${at}`).toBe(0);
            }
            await expectNoHorizontalScroll(page, at);
          }
        }
      }
    );
  }

  test(
    'last plan controls remain reachable above the two-row dock at 200% text',
    MOBILE,
    async ({ page }) => {
      await seedSettings(page, { language: 'en', themeMode: 'dark' });
      await setWidth(page, 320, 720);
      await page.goto('/istanbul/?view=plan');
      await expect(page.locator('.activity-planner')).toBeVisible();
      await expect(page.locator('.atlas-bottom-nav')).toBeVisible();
      await setTextScale(page, 200);
      await expectNoHorizontalScroll(page, '320px/200% plan at scroll end');

      // Label-size and page-overflow checks alone do not prove the fixed dock
      // leaves the final interactive content reachable above its hit area.
      let previousHeight = -1;
      let stableAtEnd = 0;
      let layout:
        | {
            dock: { top: number; bottom: number; height: number };
            appPaddingBottom: string;
            scrollAtEnd: boolean;
            scroll: { top: number; clientHeight: number; height: number };
            overlappingControls: Array<{ tag: string; label: string; top: number; bottom: number }>;
          }
        | undefined;

      await expect
        .poll(
          async () => {
            layout = await page.evaluate(() => {
              document.documentElement.style.scrollBehavior = 'auto';
              const root = document.scrollingElement;
              const dock = document.querySelector<HTMLElement>('.atlas-bottom-nav');
              const app = document.querySelector<HTMLElement>('.app');
              if (!root || !dock || !app) {
                throw new Error('Document scroll root, mobile app or bottom navigation is missing');
              }
              // Scroll again on each poll: lazy sections may extend the page after
              // the first scroll event, so wait for a stable height at the true end.
              root.scrollTop = root.scrollHeight;
              const rootHeight = root.scrollHeight;
              const rootTop = root.scrollTop;
              const dockRect = dock.getBoundingClientRect();
              const controls = Array.from(
                document.querySelectorAll<HTMLElement>(
                  '.app a[href], .app button:not([disabled]), .app input:not([disabled]), .app select:not([disabled]), .app textarea:not([disabled])'
                )
              )
                .filter(
                  control =>
                    !control.closest('.atlas-bottom-nav') &&
                    control.checkVisibility({ visibilityProperty: true })
                )
                .map(control => {
                  const rect = control.getBoundingClientRect();
                  return {
                    tag: control.tagName,
                    label: (
                      control.innerText ||
                      control.getAttribute('aria-label') ||
                      control.getAttribute('placeholder') ||
                      ''
                    )
                      .trim()
                      .replace(/\s+/g, ' ')
                      .slice(0, 60),
                    top: Math.round(rect.top),
                    bottom: Math.round(rect.bottom),
                  };
                })
                .filter(control => control.bottom > 0 && control.top < window.innerHeight);
              return {
                dock: {
                  top: Math.round(dockRect.top),
                  bottom: Math.round(dockRect.bottom),
                  height: Math.round(dockRect.height),
                },
                appPaddingBottom: getComputedStyle(app).paddingBottom,
                scrollAtEnd: rootTop + root.clientHeight >= rootHeight - 1,
                scroll: { top: rootTop, clientHeight: root.clientHeight, height: rootHeight },
                overlappingControls: controls.filter(
                  control => control.bottom > dockRect.top + 1 && control.top < dockRect.bottom - 1
                ),
              };
            });
            if (layout.scrollAtEnd && layout.scroll.height === previousHeight) stableAtEnd += 1;
            else stableAtEnd = 0;
            previousHeight = layout.scroll.height;
            return stableAtEnd;
          },
          {
            timeout: 5_000,
            message: 'page should reach a stable scroll end before dock overlap is measured',
          }
        )
        .toBeGreaterThanOrEqual(3);

      expect(layout).toBeDefined();
      expect(layout!.scrollAtEnd, JSON.stringify(layout, null, 2)).toBe(true);
      expect(
        layout!.dock.height,
        '200% text should exercise the wrapped two-row dock'
      ).toBeGreaterThan(100);
      expect(layout!.overlappingControls, JSON.stringify(layout, null, 2)).toEqual([]);
    }
  );

  test('mobile shell tracks dynamic viewport height changes', MOBILE, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/istanbul');

    const measure = async () =>
      page.evaluate(() => ({
        viewportHeight: window.innerHeight,
        bodyMinHeight: Number.parseFloat(getComputedStyle(document.body).minHeight),
        rootMinHeight: Number.parseFloat(
          getComputedStyle(document.getElementById('root')!).minHeight
        ),
        appMinHeight: Number.parseFloat(
          getComputedStyle(document.querySelector('.app')!).minHeight
        ),
      }));

    const tall = await measure();
    expect(tall.bodyMinHeight).toBeCloseTo(tall.viewportHeight, 0);
    expect(tall.rootMinHeight).toBeCloseTo(tall.viewportHeight, 0);
    expect(tall.appMinHeight).toBeCloseTo(tall.viewportHeight, 0);

    await page.setViewportSize({ width: 390, height: 600 });
    const short = await measure();
    expect(short.viewportHeight).toBe(600);
    expect(short.bodyMinHeight).toBeCloseTo(short.viewportHeight, 0);
    expect(short.rootMinHeight).toBeCloseTo(short.viewportHeight, 0);
    expect(short.appMinHeight).toBeCloseTo(short.viewportHeight, 0);
  });
});
