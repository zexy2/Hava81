import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const out = process.env.HAVA81_MAP_CAPTURE_DIR || 'test-results/map-loading-visual/screens';
const beforeUrl = process.env.HAVA81_BEFORE_URL || 'https://hava81.zekiakgul.dev';
const afterUrl = process.env.HAVA81_AFTER_URL || 'http://127.0.0.1:44881';
const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/ubuntu/Hava81-visual-overhaul-20261009/.pw-browsers/chromium_headless_shell-1234/chrome-linux/headless_shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
  'base64'
);
const viewports = [
  { name: 'desktop-light', width: 1440, height: 900, theme: 'light' },
  { name: 'mobile-light', width: 390, height: 844, theme: 'light' },
  { name: 'mobile-dark', width: 390, height: 844, theme: 'dark' },
  { name: 'compact-light', width: 320, height: 720, theme: 'light' },
];
await fs.mkdir(out, { recursive: true });
const measurements = [];
for (const [phase, rootUrl] of [['before', beforeUrl], ['after', afterUrl]]) {
  for (const viewport of viewports) {
    for (const scenario of viewport.name === 'mobile-light' ? ['loading', 'failed'] : ['loading']) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        serviceWorkers: 'block',
      });
      const errors = [];
      let pending = 0;
      let release = () => {};
      const gate = new Promise(resolve => { release = resolve; });
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(({ theme }) => {
        localStorage.setItem('user-settings', JSON.stringify({
          temperatureUnit: 'metric', windSpeedUnit: 'ms', language: 'tr', themeMode: theme,
        }));
      }, { theme: viewport.theme });
      // The local production preview has no BFF proxy. Use the real
      // deployed weather API only for documentary screenshots; tests
      // use their own deterministic fixture responses.
      if (phase === 'after') {
        await page.route('**/api/v1/**', async route => {
          const url = new URL(route.request().url());
          try {
            const response = await route.fetch({
              url: 'https://api.hava81.zekiakgul.dev' + url.pathname + url.search,
              timeout: 20000,
            });
            await route.fulfill({ response });
          } catch (error) {
            errors.push('API mirror: ' + error.message);
            await route.abort();
          }
        });
      }
      // Deterministic, valid BFF fixtures on BOTH preview and current live
      // client keep visual comparisons independent of provider rate limits.
      const now = new Date().toISOString();
      const weather = {
        cityName: 'İzmir', country: 'TR', temperature: 22, feelsLike: 21,
        tempMin: 17, tempMax: 25, humidity: 58, pressure: 1012,
        visibility: 10000, windSpeed: 4.2, windDirection: 180,
        description: 'açık', icon: '01d',
        sunrise: new Date(Date.now() - 6 * 3600_000).toISOString(),
        sunset: new Date(Date.now() + 6 * 3600_000).toISOString(),
        timestamp: now, coordinates: { lat: 38.42, lon: 27.14 }, clouds: 5,
        meta: { provider: 'OpenWeather', fetchedAt: now, timezoneOffsetSeconds: 10800,
          cacheStatus: 'MISS', freshForSeconds: 300 },
      };
      const forecast = {
        daily: [{ date: now.slice(0, 10), tempMin: 17, tempMax: 25,
          icon: '01d', description: 'açık', pop: 10 }],
        hourly: [{ time: new Date(Date.now() + 3600_000).toISOString(),
          temp: 22, icon: '01d', description: 'açık', pop: 10, windSpeed: 4 }],
        meta: { provider: 'OpenWeather', fetchedAt: now, timezoneOffsetSeconds: 10800,
          intervalHours: 3, cacheStatus: 'MISS', freshForSeconds: 300 },
      };
      await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: weather }));
      await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
      await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: forecast }));
      await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({
        json: { aqi: 2, aqiLabel: 'Orta', pm25: 9, pm10: 14, o3: 42,
          meta: { provider: 'OpenWeather', fetchedAt: now, cacheStatus: 'MISS',
            freshForSeconds: 300 } },
      }));
      await page.route('**/api/v1/weather/context**', route => route.fulfill({
        json: { provider: 'Open-Meteo', fetchedAt: now, attribution: 'Open-Meteo',
          uvIndexMax: 5, dustMax: 2, grassPollenMax: 1, olivePollenMax: 0 },
      }));
      if (scenario === 'loading') {
        await page.route('**/hot/**', async route => {
          pending += 1;
          await gate;
          await route.fulfill({ status: 200, contentType: 'image/png', body: png }).catch(() => {});
        });
      } else {
        await page.route('**/hot/**', route => route.fulfill({ status: 503, body: 'No tiles' }));
        await page.route('**/tiles/osmde/**', route => route.fulfill({ status: 503, body: 'No tiles' }));
      }
      const filename = [phase, viewport.name, scenario].join('-');
      try {
        const response = await page.goto(rootUrl + '/izmir/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        const btn = viewport.width < 768
          ? page.locator('.atlas-bottom-nav').getByRole('button', { name: 'Harita' })
          : page.locator('.atlas-icon-button--map').first();
        await btn.click({ timeout: 20000 });
        const map = page.locator('.atlas-map-panel');
        await map.waitFor({ state: 'visible', timeout: 15000 });
        if (scenario === 'loading') {
          await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile').length > 0);
          await page.waitForFunction(() => !!document.querySelector('.weather-map__tile-status:not(.weather-map__tile-status--failed)'));
        } else {
          await map.locator('.weather-map__tile-status--failed').waitFor({ state: 'visible', timeout: 18000 });
        }
        await map.screenshot({ path: path.join(out, filename + '.png'), timeout: 20000, animations: 'disabled' });
        const geometry = await map.evaluate(el => {
          const container = el.querySelector('.weather-map__container');
          const leaflet = el.querySelector('.weather-map__leaflet');
          const status = el.querySelector('.weather-map__tile-status');
          return {
            decorativeBackground: getComputedStyle(container).backgroundImage,
            leafletBackground: getComputedStyle(leaflet).backgroundColor,
            failed: status?.classList.contains('weather-map__tile-status--failed'),
            overflow: document.documentElement.scrollWidth - innerWidth,
            statusText: status?.textContent.trim(),
          };
        });
        measurements.push({
          phase, viewport: viewport.name, scenario,
          status: response?.status(), errors, geometry, screenshot: filename + '.png',
        });
        console.log('CAPTURED', filename, JSON.stringify({ status: response?.status(), errors, ...geometry }));
      } catch (e) {
        measurements.push({ phase, viewport: viewport.name, scenario, error: e.message, errors });
        console.log('FAILED', filename, e.message);
      } finally {
        release();
        await page.close();
      }
    }
  }
}
await browser.close();
await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(measurements, null, 2));
const fail = measurements.filter(m =>
  m.error || m.status !== 200 || m.errors.length || m.geometry?.overflow > 0 ||
  (m.scenario === 'failed') !== m.geometry?.failed
);
console.log('VISUAL_AUDIT', measurements.length - fail.length, '/', measurements.length);
if (fail.length) process.exitCode = 1;
