import { expect, test } from '@playwright/test';

test('tablet decision alerts wrap instead of clipping at 200% text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single tablet text-resize regression');

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/istanbul/');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  const panel = page.locator('.decision-alerts');
  await expect(panel).toBeVisible();

  const layout = await panel.evaluate(element => {
    const copy = element.firstElementChild?.getBoundingClientRect();
    const button = element.querySelector('button')?.getBoundingClientRect();
    const panelRect = element.getBoundingClientRect();
    if (!copy || !button) throw new Error('Missing decision alert content');

    return {
      viewportWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      panelClientWidth: element.clientWidth,
      panelScrollWidth: element.scrollWidth,
      panelLeft: panelRect.left,
      panelRight: panelRect.right,
      copyRight: copy.right,
      buttonLeft: button.left,
      buttonRight: button.right,
      buttonTop: button.top,
      copyBottom: copy.bottom,
    };
  });

  expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.panelScrollWidth).toBeLessThanOrEqual(layout.panelClientWidth + 1);
  expect(layout.panelLeft).toBeGreaterThanOrEqual(-1);
  expect(layout.panelRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.copyRight).toBeLessThanOrEqual(layout.panelRight + 1);
  expect(layout.buttonLeft).toBeGreaterThanOrEqual(layout.panelLeft - 1);
  expect(layout.buttonRight).toBeLessThanOrEqual(layout.panelRight + 1);
  expect(layout.buttonTop).toBeGreaterThanOrEqual(layout.copyBottom - 1);
});
