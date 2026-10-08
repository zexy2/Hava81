import { expect, test } from '@playwright/test';

test('mobile decision hero shows the useful timing and umbrella summary', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile-only hero layout');
  await page.goto('/izmir/');
  await expect(page.locator('.decision-glance')).toBeVisible();
  await expect(page.locator('.decision-glance__quick').first()).toBeVisible();
  await expect(page.locator('.decision-glance__quick').nth(1)).toBeVisible();
  const hero = page.locator('.decision-glance');
  const quick = await page.locator('.decision-glance__quick').first().boundingBox();
  const score = await page.locator('.decision-glance__score').boundingBox();
  const box = await hero.boundingBox();
  expect(quick && box && quick.x >= box.x && quick.x + quick.width <= box.x + box.width).toBe(true);
  expect(score && box && score.x + score.width <= box.x + box.width + 1).toBe(true);
});

test('200 percent mobile text keeps hero readable and score inside the card', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile-only large-text layout');
  await page.goto('/izmir/');
  await expect(page.locator('.decision-glance')).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const layout = await page.locator('.decision-glance').evaluate(section => {
    const hero = section.getBoundingClientRect();
    const message = section.querySelector('.decision-glance__message')!.getBoundingClientRect();
    const score = section.querySelector('.decision-glance__score')!.getBoundingClientRect();
    const number = section.querySelector('.decision-glance__score strong')!.getBoundingClientRect();
    return {
      height: hero.height,
      messageWidth: message.width,
      numberFits: number.left >= score.left && number.right <= score.right,
      scoreFits: score.left >= hero.left && score.right <= hero.right,
      screenFits: document.documentElement.scrollWidth <= innerWidth,
    };
  });
  expect(layout.messageWidth).toBeGreaterThan(150);
  expect(layout.height).toBeLessThan(850);
  expect(layout.numberFits).toBe(true);
  expect(layout.scoreFits).toBe(true);
  expect(layout.screenFits).toBe(true);
});
