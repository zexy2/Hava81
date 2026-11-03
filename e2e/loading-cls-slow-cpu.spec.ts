/**
 * #1782: the loading-to-weather transition stays below 0.05 CLS on a slow CPU too.
 * The ordinary test (loading-state-layout-shift.spec.ts) passes on fast machines because the
 * swap lands in one frame; a 6x throttled CPU makes it land in two, as slow CI runners do.
 *
 * FROZEN: written before the implementation and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it.
 */
import { MOBILE, expect, test } from './helpers/test';
import { fixtures, overrideApi } from './helpers/weather-fixtures';

test(
  '#1782 the mobile loading-to-weather transition stays below 0.05 CLS on a slow CPU',
  MOBILE,
  async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await page.addInitScript(() => {
      const target = window as Window & { __hava81LayoutShift?: number };
      target.__hava81LayoutShift = 0;
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (shift.hadRecentInput !== true)
            target.__hava81LayoutShift = (target.__hava81LayoutShift ?? 0) + (shift.value ?? 0);
        }
      }).observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
    });
    await overrideApi(page, 'current', async route => {
      await new Promise(resolve => setTimeout(resolve, 1400));
      await route.fulfill({ json: fixtures.current });
    });

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/istanbul/?clsSlowProbe=${width}`);
      await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible({
        timeout: 30_000,
      });
      // The forecast and its UV arrive after the current reading; wait until they have.
      await expect(page.locator('.hava81-decision-field__trend-wrap')).toBeVisible({
        timeout: 30_000,
      });
      await page.evaluate(
        () =>
          new Promise<void>(resolve =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const cls = await page.evaluate(
        () => (window as Window & { __hava81LayoutShift?: number }).__hava81LayoutShift ?? 0
      );
      console.info(`[layout-shift slow-cpu] ${width}px CLS ${cls.toFixed(3)}`);
      expect(cls, `${width}px under a 6x slower CPU`).toBeLessThan(0.05);
    }
  }
);
