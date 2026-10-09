import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const out = process.env.HAVA81_FORECAST_VISUAL_DIR || 'test-results/forecast-calendar/visual';
const live = process.env.HAVA81_FORECAST_BEFORE_URL || 'https://hava81.zekiakgul.dev';
const preview = process.env.HAVA81_FORECAST_AFTER_URL || 'http://127.0.0.1:4173';
const cases = [
  { name: 'desktop-light', width: 1440, height: 900, theme: 'light' },
  { name: 'tablet-light', width: 768, height: 1024, theme: 'light' },
  { name: 'mobile-light', width: 390, height: 844, theme: 'light' },
  { name: 'mobile-dark', width: 390, height: 844, theme: 'dark' },
  { name: 'compact-light', width: 320, height: 720, theme: 'light' },
  { name: 'desktop-zoom', width: 1280, height: 900, theme: 'light', zoom: true },
];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const cache = new Map();
const findings = [];
await fs.mkdir(out, { recursive: true });

for (const [phase, url] of [
  ['before', live],
  ['after', preview],
].filter(([phase]) => !process.env.ONLY_AFTER || phase === 'after')) {
  for (const spec of cases.filter(
    item => !process.env.ONLY_DESKTOP || item.name === 'desktop-light'
  )) {
    const page = await browser.newPage({
      viewport: { width: spec.width, height: spec.height },
      colorScheme: spec.theme,
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(
      ({ theme }) =>
        localStorage.setItem(
          'user-settings',
          JSON.stringify({
            temperatureUnit: 'metric',
            windSpeedUnit: 'ms',
            language: 'tr',
            themeMode: theme,
            notificationsEnabled: false,
          })
        ),
      { theme: spec.theme }
    );
    await page.route('**/api/v1/**', async route => {
      const request = new URL(route.request().url());
      const key = request.pathname + request.search;
      try {
        let value = cache.get(key);
        if (!value) {
          const response = await route.fetch({
            url: 'https://api.hava81.zekiakgul.dev' + key,
            timeout: 25000,
          });
          value = {
            status: response.status(),
            body: await response.body(),
            contentType: response.headers()['content-type'] || 'application/json',
          };
          if (response.ok()) cache.set(key, value);
        }
        await route.fulfill(value);
      } catch (error) {
        errors.push(String(error));
        await route.abort();
      }
    });
    const label = phase + '-' + spec.name;
    try {
      const response = await page.goto(url + '/izmir/', {
        waitUntil: 'domcontentloaded',
        timeout: 35000,
      });
      if (spec.zoom)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
      await page
        .locator('.hava81-forecast-atlas__day')
        .first()
        .waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForTimeout(500);
      const days = page.locator('.hava81-forecast-atlas__days');
      await days.screenshot({
        path: path.join(out, label + '-calendar.png'),
        animations: 'disabled',
      });
      await page.screenshot({
        path: path.join(out, label + '-viewport.png'),
        animations: 'disabled',
      });
      const metrics = await page.evaluate(() => {
        const days = document.querySelector('.hava81-forecast-atlas__days');
        const cards = [...document.querySelectorAll('.hava81-forecast-atlas__day')];
        const style = getComputedStyle(days);
        return {
          pageWidth: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
          cardCount: cards.length,
          columns: style.gridTemplateColumns,
          backgrounds: getComputedStyle(cards[0]).backgroundImage,
          areas: getComputedStyle(cards[0]).gridTemplateAreas,
          stylesheetUrls: [...document.styleSheets].map(s => s.href || 'inline'),
          currentUrl: location.href,
          appClass: document.querySelector('.app')?.className,
          firstCardClass: cards[0]?.className,
          matchesAppDescendant: document.querySelector('.app')?.contains(cards[0]),
          customRuleLoaded: [...document.styleSheets].some(s =>
            [...s.cssRules].some(r => r.cssText.includes('#c6e2fa'))
          ),
          styleTags: document.querySelectorAll('style').length,
          cardWidths: cards.map(card => Math.round(card.getBoundingClientRect().width)),
          cardTextOverflows: cards.map(card =>
            [
              ...card.querySelectorAll(
                '.hava81-forecast-atlas__day-name, .hava81-forecast-atlas__description, .hava81-forecast-atlas__day-temperatures, .hava81-forecast-atlas__day-pop'
              ),
            ].some(el => el.scrollWidth > el.clientWidth + 3)
          ),
        };
      });
      findings.push({ label, status: response?.status(), errors, ...metrics });
      console.log(label, JSON.stringify(metrics), 'errors', errors.length);
    } catch (error) {
      console.log(label, 'ERROR', String(error));
      findings.push({ label, error: String(error), errors });
    } finally {
      await page.close();
    }
  }
}
await browser.close();
await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(findings, null, 2));
const broken = findings.filter(
  item =>
    item.error ||
    item.errors?.length ||
    item.cardCount !== 5 ||
    item.pageWidth > item.viewport + 1 ||
    item.cardTextOverflows?.includes(true)
);
console.log('VISUAL_RESULT', findings.length - broken.length, '/', findings.length);
if (broken.length) process.exitCode = 1;
