import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const liveUrl = process.env.HAVA81_ACTIVITY_BEFORE_URL || 'https://hava81.zekiakgul.dev';
const previewUrl = process.env.HAVA81_ACTIVITY_AFTER_URL || 'http://127.0.0.1:45981';
const output = process.env.HAVA81_ACTIVITY_OUTPUT || 'test-results/activity-editorial/captures';
const variants = [
  { name: 'desktop-light', width: 1440, height: 900, theme: 'light' },
  { name: 'tablet-light', width: 768, height: 1024, theme: 'light' },
  { name: 'mobile-light', width: 390, height: 844, theme: 'light' },
  { name: 'mobile-dark', width: 390, height: 844, theme: 'dark' },
  { name: 'compact-light', width: 320, height: 700, theme: 'light' },
  { name: 'desktop-text-200', width: 1280, height: 900, theme: 'light', textZoom: true },
  { name: 'mobile-text-200', width: 390, height: 844, theme: 'light', textZoom: true },
];
const phaseFilter = process.env.HAVA81_ACTIVITY_PHASE;
const variantFilter = process.env.HAVA81_ACTIVITY_VARIANT;
const responseCache = new Map();
const results = [];
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
for (const [phase, base] of [
  ['before', liveUrl],
  ['after', previewUrl],
]) {
  if (phaseFilter && phase !== phaseFilter) continue;
  for (const variant of variants.filter(
    item =>
      !process.env.HAVA81_ACTIVITY_ONLY_VARIANT ||
      item.name === process.env.HAVA81_ACTIVITY_ONLY_VARIANT
  )) {
    if (variantFilter && variant.name !== variantFilter) continue;
    const page = await browser.newPage({
      viewport: { width: variant.width, height: variant.height },
      deviceScaleFactor: 1,
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(theme => {
      localStorage.setItem(
        'user-settings',
        JSON.stringify({
          temperatureUnit: 'metric',
          windSpeedUnit: 'ms',
          language: 'tr',
          themeMode: theme,
        })
      );
    }, variant.theme);
    if (phase === 'after') {
      // Share the production read-only weather responses with the isolated
      // preview. The development server itself is not an API provider.
      await page.route('**/api/v1/weather/**', async route => {
        const url = new URL(route.request().url());
        const key = url.pathname + url.search;
        try {
          let record = responseCache.get(key);
          if (!record) {
            const response = await route.fetch({
              url: 'https://api.hava81.zekiakgul.dev' + key,
              timeout: 18000,
            });
            record = {
              status: response.status(),
              body: await response.body(),
              contentType: response.headers()['content-type'] || 'application/json',
            };
            if (response.ok()) responseCache.set(key, record);
          }
          await route.fulfill(record);
        } catch (error) {
          errors.push('Fixture loading failed: ' + error.message);
          await route.abort();
        }
      });
    }
    try {
      const response = await page.goto(base + '/izmir/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      const section = page.locator('section.activity-planner');
      await section.waitFor({ state: 'attached', timeout: 28000 });
      await section.scrollIntoViewIfNeeded();
      if (variant.textZoom)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
      const chips = section.locator('.activity-planner__chips button');
      for (let i = 0; i < 2; i++) {
        if ((await chips.nth(i).getAttribute('aria-pressed')) === 'false')
          await chips.nth(i).click();
      }
      await section.locator('.activity-card').first().waitFor({ state: 'visible', timeout: 18000 });
      await page.addStyleTag({
        content:
          '.atlas-header, .atlas-bottom-nav, .skip-link, .skip-to-content { visibility: hidden !important; }',
      });
      await page.waitForTimeout(230);
      const filename = path.join(output, phase + '-' + variant.name + '.png');
      await section.screenshot({ path: filename, animations: 'disabled', timeout: 30000 });
      const metrics = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        theme: document.querySelector('.app')?.getAttribute('data-color-mode'),
        cards: document.querySelectorAll('.activity-card').length,
        selected: document.querySelectorAll('.activity-planner__chips button[aria-pressed="true"]')
          .length,
        headerGradient: getComputedStyle(document.querySelector('.activity-planner__header'))
          .backgroundImage,
        score: document.querySelector('.activity-card__score strong')?.textContent,
      }));
      const result = {
        phase,
        variant: variant.name,
        status: response?.status(),
        errors,
        filename,
        ...metrics,
      };
      results.push(result);
      console.log('CAPTURE', JSON.stringify(result));
    } catch (error) {
      const result = { phase, variant: variant.name, error: error.message, errors };
      results.push(result);
      console.log('FAILED', JSON.stringify(result));
    } finally {
      await page.close();
    }
  }
}
await browser.close();
const prior = await fs
  .readFile(path.join(output, 'report.json'), 'utf8')
  .then(JSON.parse)
  .catch(() => []);
const merged = new Map(prior.map(entry => [entry.phase + ':' + entry.variant, entry]));
for (const entry of results) merged.set(entry.phase + ':' + entry.variant, entry);
const allResults = Array.from(merged.values());
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(allResults, null, 2));
const failing = results.filter(
  entry =>
    entry.error ||
    entry.errors?.length ||
    entry.status !== 200 ||
    entry.documentWidth > entry.viewport + 1 ||
    entry.cards !== 2 ||
    entry.selected !== 2 ||
    entry.theme !== (entry.variant.includes('dark') ? 'dark' : 'light')
);
console.log('AUDIT', results.length - failing.length, '/', results.length);
if (failing.length > 0) process.exitCode = 1;
