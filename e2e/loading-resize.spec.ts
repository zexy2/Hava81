import { expect, test } from '@playwright/test';

test('desktop loading shell stays inside the viewport at 200% text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single desktop text-resize regression');

  let releaseCurrent!: () => void;
  const currentGate = new Promise<void>(resolve => {
    releaseCurrent = resolve;
  });

  await page.route('**/api/v1/weather/current**', async route => {
    await currentGate;
    await route.abort();
  });

  try {
    await page.goto('/istanbul/');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });

    const loading = page.locator('.atlas-loading');
    await expect(loading).toBeVisible();

    const layout = await loading.evaluate(element => {
      const viewportWidth = document.documentElement.clientWidth;
      const loadingRect = element.getBoundingClientRect();
      const decisionRect = element.querySelector('.atlas-loading__decision')?.getBoundingClientRect();
      const forecastRect = element.querySelector('.atlas-loading__forecast')?.getBoundingClientRect();

      return {
        viewportWidth,
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        loadingLeft: loadingRect.left,
        loadingRight: loadingRect.right,
        loadingClientWidth: element.clientWidth,
        loadingScrollWidth: element.scrollWidth,
        decisionRight: decisionRect?.right ?? 0,
        forecastRight: forecastRect?.right ?? 0,
      };
    });

    expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth + 1);
    expect(layout.loadingScrollWidth).toBeLessThanOrEqual(layout.loadingClientWidth + 1);
    expect(layout.loadingLeft).toBeGreaterThanOrEqual(-1);
    expect(layout.loadingRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.decisionRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.forecastRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
  } finally {
    releaseCurrent();
  }
});
