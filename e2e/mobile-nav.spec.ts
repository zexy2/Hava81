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
import { mockWeatherApi, seedSettings } from './helpers/weather-fixtures';

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

test('main content can scroll fully above the fixed dock at 200% text', MOBILE, async ({ page }) => {
  await mockWeatherApi(page);
  await setWidth(page, 320, 720);
  await page.goto('/istanbul/');
  await expect(page.locator('.decision-glance__score')).toBeVisible();

  // Portrait makes the labels wrap into two dock rows; landscape uses the
  // compact horizontal dock. In both cases the last content edge must remain
  // reachable above the fixed navigation, not just above the viewport edge.
  for (const viewport of [
    { width: 320, height: 720, name: 'portrait' },
    { width: 568, height: 320, name: 'landscape' },
  ]) {
    await setWidth(page, viewport.width, viewport.height);
    await setTextScale(page, 200);
    // The deferred forecast can extend the document after its slot activates;
    // scroll to the current end repeatedly until its height has settled.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await page.evaluate(() => {
        // The app enables smooth scrolling by default; use an instant end jump
        // so this geometry assertion measures the settled bottom, not animation.
        document.documentElement.style.scrollBehavior = 'auto';
        const scroller = document.scrollingElement;
        if (scroller) scroller.scrollTo(0, scroller.scrollHeight);
      });
      await page.waitForTimeout(100);
    }

    const geometry = await page.evaluate(() => {
      const main = document.querySelector('#main-content');
      const dock = document.querySelector('.atlas-bottom-nav');
      const scroller = document.scrollingElement;
      if (!main || !dock || !scroller) throw new Error('main content, dock, or scroller is missing');
      const mainRect = main.getBoundingClientRect();
      const dockRect = dock.getBoundingClientRect();
      return {
        mainBottom: Math.round(mainRect.bottom),
        dockTop: Math.round(dockRect.top),
        dockHeight: Math.round(dockRect.height),
        viewportHeight: window.innerHeight,
        clientHeight: scroller.clientHeight,
        scrollHeight: scroller.scrollHeight,
        scrollTop: scroller.scrollTop,
        maxScroll: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
      };
    });
    expect(
      Math.abs(geometry.maxScroll - geometry.scrollTop),
      `${viewport.name} must reach the true document end: ${JSON.stringify(geometry)}`
    ).toBeLessThanOrEqual(2);
    expect(
      geometry.dockTop - geometry.mainBottom,
      `${viewport.name} 200% text must leave an 8px gap above the dock: ${JSON.stringify(geometry)}`
    ).toBeGreaterThanOrEqual(8);
  }
});