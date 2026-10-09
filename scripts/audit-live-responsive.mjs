#!/usr/bin/env node
/** Read-only live responsive audit. Run manually; do not make public network
 * or weather-provider availability a mandatory CI requirement. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function parseOptions(args) {
  const options = {
    baseUrl: process.env.HAVA81_AUDIT_BASE_URL || 'https://hava81.zekiakgul.dev',
    screenshots: false,
    output: 'test-results/live-responsive-audit',
    cities: ['izmir', 'sanliurfa'],
    languages: ['tr'],
    themes: ['light'],
    cases: [
      [320, 100], [320, 200], [390, 100], [390, 200],
      [768, 100], [768, 200], [1024, 100], [1440, 100],
    ],
  };
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (flag === '--screenshots') options.screenshots = true;
    else if (flag === '--quick') options.cases = [[320, 100], [320, 200], [390, 100], [768, 100], [1440, 100]];
    else if (['--base-url', '--output', '--cities', '--languages', '--themes'].includes(flag)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
      if (flag === '--base-url') options.baseUrl = value;
      if (flag === '--output') options.output = value;
      if (flag === '--cities') options.cities = value.split(',').map(v => v.trim()).filter(Boolean);
      if (flag === '--languages') options.languages = value.split(',').map(v => v.trim()).filter(Boolean);
      if (flag === '--themes') options.themes = value.split(',').map(v => v.trim()).filter(Boolean);
    } else if (flag === '--help') {
      console.log('Usage: npm run audit:live-ui -- [--base-url URL] [--cities izmir,sanliurfa] [--quick] [--languages tr,en] [--themes light,dark] [--screenshots] [--output DIRECTORY]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${flag}`);
  }
  const url = new URL(options.baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Base URL must be HTTP(S)');
  options.baseUrl = url.origin;
  if (options.cities.some(v => !/^[a-z-]+$/.test(v))) throw new Error('Cities must be URL-safe slugs');
  if (!options.languages.length || options.languages.some(v => !['tr', 'en'].includes(v))) {
    throw new Error('Languages must be one or more of: tr,en');
  }
  if (!options.themes.length || options.themes.some(v => !['light', 'dark'].includes(v))) {
    throw new Error('Themes must be one or more of: light,dark');
  }
  return options;
}

const options = parseOptions(process.argv.slice(2));
const cityNames = { izmir: 'İzmir', sanliurfa: 'Şanlıurfa' };
console.log(`Starting read-only audit at ${options.baseUrl} for ${options.cities.length} cities, ${options.languages.join('/')} languages, ${options.themes.join('/')} themes...`);
const browser = await chromium.launch({
  timeout: 30_000,
  executablePath: process.env.HAVA81_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: process.env.HAVA81_CHROMIUM_EXECUTABLE_PATH ? ['--no-sandbox'] : [],
});
const results = [];
try {
  if (options.screenshots) await mkdir(options.output, { recursive: true });
  const variants = options.cities.flatMap(city =>
    options.languages.flatMap(language =>
      options.themes.map(theme => ({ city, language, theme }))));
  for (const { city, language, theme } of variants) {
    for (const [width, zoom] of options.cases) {
      const item = { city, language, theme, width, zoom, ok: false, errors: [], metrics: null };
      // A single failed external weather request must not be misdiagnosed as
      // a stable CSS regression. Retry a cold page once before recording it.
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        console.log(`CHECK ${city} ${language}/${theme} ${width}px zoom=${zoom}% (attempt ${attempt}/2)`);
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        page.setDefaultTimeout(15_000);
        // Browser context is isolated per case; live user settings are never changed.
        await page.addInitScript(({ language, theme }) => {
          localStorage.setItem('user-settings', JSON.stringify({
            temperatureUnit: 'metric', windSpeedUnit: 'ms', language, themeMode: theme,
          }));
        }, { language, theme });
        const pageErrors = [];
        const weatherFailures = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('response', response => {
          if (response.url().includes('/api/v1/weather/') && response.status() >= 400) {
            weatherFailures.push(`${response.status()} ${response.url().split('?')[0]}`);
          }
        });
        try {
          await page.goto(`${options.baseUrl}/${city}/`, { waitUntil: 'domcontentloaded', timeout: 25_000 });
          await page.locator('.decision-glance__score').waitFor({ timeout: 20_000 });
          await page.locator('.hava81-decision-field__city').waitFor({ timeout: 15_000 });
          await page.evaluate(value => { document.documentElement.style.fontSize = `${value}%`; }, zoom);
          item.metrics = await page.evaluate(() => {
            const element = selector => document.querySelector(selector);
            const bounds = selector => element(selector)?.getBoundingClientRect() || null;
            const isVisible = selector => {
              const node = element(selector);
              return !!node && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden';
            };
            const overlap = (a, b) => {
              if (!a || !b) return 0;
              return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
                Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            };
            return {
              city: element('.hava81-decision-field__city')?.textContent?.trim(),
              language: document.documentElement.lang,
              theme: element('.app')?.getAttribute('data-color-mode'),
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: innerWidth,
              headerHeight: Math.round(bounds('.atlas-header__inner')?.height || 0),
              overlaps: {
                header: Math.round(overlap(bounds('.atlas-brand'), bounds('.atlas-header__actions'))),
                scoreDate: isVisible('.decision-glance__date')
                  ? Math.round(overlap(bounds('.decision-glance__score'), bounds('.decision-glance__date'))) : 0,
                scoreDetails: Math.round(overlap(bounds('.decision-glance__score'), bounds('.decision-glance__details'))),
                temperatureArt: Math.round(overlap(bounds('.hava81-decision-field__temperature'), bounds('.hava81-decision-field__symbol'))),
              },
            };
          });
          const expectedCity = cityNames[city];
          item.errors = [
            ...(expectedCity && item.metrics.city !== expectedCity ? [`Expected ${expectedCity}, got ${item.metrics.city}`] : []),
            ...(item.metrics.language !== language ? [`Expected language ${language}, got ${item.metrics.language}`] : []),
            ...(item.metrics.theme !== theme ? [`Expected theme ${theme}, got ${item.metrics.theme}`] : []),
            ...(item.metrics.documentWidth > width + 1 ? [`Horizontal overflow: ${item.metrics.documentWidth}px > ${width}px`] : []),
            ...Object.entries(item.metrics.overlaps).filter(([,area]) => area > 1).map(([name,area]) => `${name} overlap: ${area}px²`),
            ...pageErrors.map(error => `JavaScript: ${error}`),
          ];
          item.ok = item.errors.length === 0;
          if (options.screenshots) {
            const variant = language === 'tr' && theme === 'light' ? '' : `-${language}-${theme}`;
            await page.screenshot({ path: join(options.output, `${city}-${width}-zoom${zoom}${variant}.png`), animations: 'disabled' });
          }
          if (item.ok || attempt === 2) break;
        } catch (error) {
          item.errors = [`Attempt ${attempt}: ${error.message}`, ...weatherFailures, ...pageErrors];
          // A timeout might be a weather-provider failure, not a CSS regression.
          // Save the visible error state and failed network status for diagnosis.
          const message = await page.locator('.atlas-message--error').first()
            .textContent({ timeout: 500 }).catch(() => null);
          if (message) item.errors.push(`Visible message: ${message.trim().slice(0, 180)}`);
          if (options.screenshots) {
            const variant = `${language}-${theme}-${width}-zoom${zoom}-attempt${attempt}`;
            await page.screenshot({ path: join(options.output, `${city}-failed-${variant}.png`), timeout: 4_000 }).catch(() => {});
          }
        } finally {
          await page.close();
        }
      }
      results.push(item);
      console.log(`${item.ok ? 'PASS' : 'FAIL'} ${city} ${language}/${theme} ${width}px zoom=${zoom}% ${item.errors.join('; ')}`.trim());
    }
  }
} finally {
  await browser.close();
}
const failed = results.filter(item => !item.ok);
if (options.screenshots) {
  await writeFile(join(options.output, 'results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), baseUrl: options.baseUrl, results }, null, 2));
}
console.log(`Responsive audit: ${results.length - failed.length}/${results.length} passed.`);
if (failed.length) process.exitCode = 1;
