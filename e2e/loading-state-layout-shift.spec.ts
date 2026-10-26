import { MOBILE, expect, test } from './helpers/test';
import { fixtures, overrideApi } from './helpers/weather-fixtures';

test(
  'keeps the mobile loading-to-weather transition below 0.05 CLS',
  MOBILE,
  async ({ page }) => {
    await page.addInitScript(() => {
      const target = window as Window & { __hava81LayoutShift?: number };
      target.__hava81LayoutShift = 0;
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (shift.hadRecentInput !== true) {
            target.__hava81LayoutShift = (target.__hava81LayoutShift ?? 0) + (shift.value ?? 0);
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
    });

    await overrideApi(page, 'current', async route => {
      await new Promise(resolve => setTimeout(resolve, 1400));
      await route.fulfill({ json: fixtures.current });
    });

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/istanbul/?clsProbe=${width}`);
      await expect(page.locator('.atlas-loading')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
      await page.evaluate(
        () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      );

      const cls = await page.evaluate(
        () => (window as Window & { __hava81LayoutShift?: number }).__hava81LayoutShift ?? 0
      );
      console.info(`[layout-shift] ${width}px CLS ${cls.toFixed(3)}`);
      expect(
        cls,
        `${width}px loading skeleton should reserve the incoming hero layout`
      ).toBeLessThan(0.05);
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    }
  }
);
