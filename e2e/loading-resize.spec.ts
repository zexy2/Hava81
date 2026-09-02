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
      const decision = element.querySelector('.atlas-loading__decision');
      const forecast = element.querySelector('.atlas-loading__forecast');
      const decisionRect = decision?.getBoundingClientRect();
      const forecastRect = forecast?.getBoundingClientRect();
      const decisionStyle = decision ? getComputedStyle(decision) : null;
      const forecastStyle = forecast ? getComputedStyle(forecast) : null;

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
        decisionStyle: decisionStyle
          ? {
              background: decisionStyle.backgroundColor,
              borderTopWidth: decisionStyle.borderTopWidth,
              borderRightWidth: decisionStyle.borderRightWidth,
              borderBottomWidth: decisionStyle.borderBottomWidth,
              borderLeftWidth: decisionStyle.borderLeftWidth,
              borderRadius: decisionStyle.borderRadius,
              boxShadow: decisionStyle.boxShadow,
            }
          : null,
        forecastStyle: forecastStyle
          ? {
              background: forecastStyle.backgroundColor,
              borderTopWidth: forecastStyle.borderTopWidth,
              borderRightWidth: forecastStyle.borderRightWidth,
              borderBottomWidth: forecastStyle.borderBottomWidth,
              borderLeftWidth: forecastStyle.borderLeftWidth,
              borderRadius: forecastStyle.borderRadius,
              boxShadow: forecastStyle.boxShadow,
            }
          : null,
      };
    });

    expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth + 1);
    expect(layout.loadingScrollWidth).toBeLessThanOrEqual(layout.loadingClientWidth + 1);
    expect(layout.loadingLeft).toBeGreaterThanOrEqual(-1);
    expect(layout.loadingRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.decisionRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.forecastRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
    for (const style of [layout.decisionStyle, layout.forecastStyle]) {
      expect(style).not.toBeNull();
      expect(style?.background).toBe('rgba(0, 0, 0, 0)');
      expect(style?.borderTopWidth).toBe('1px');
      expect(style?.borderBottomWidth).toBe('1px');
      expect(style?.borderRightWidth).toBe('0px');
      expect(style?.borderLeftWidth).toBe('0px');
      expect(style?.borderRadius).toBe('0px');
      expect(style?.boxShadow).toBe('none');
    }
  } finally {
    releaseCurrent();
  }
});
