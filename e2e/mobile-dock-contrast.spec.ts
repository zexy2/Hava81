import { expect, test } from '@playwright/test';

const now = Date.now();
const iso = (hours = 0) => new Date(now + hours * 60 * 60_000).toISOString();
const localDate = new Date(now + 3 * 60 * 60_000).toISOString().slice(0, 10);

const current = {
  cityName: 'İstanbul', country: 'TR', temperature: 23, feelsLike: 23, tempMin: 19, tempMax: 27,
  humidity: 58, pressure: 1012, visibility: 10000, windSpeed: 4.2, windDirection: 180,
  description: 'açık', icon: '01d', sunrise: iso(-6), sunset: iso(6), timestamp: iso(),
  coordinates: { lat: 41.01, lon: 28.97 }, clouds: 5,
  meta: { provider: 'OpenWeather', fetchedAt: iso(), timezoneOffsetSeconds: 10800, cacheStatus: 'MISS', freshForSeconds: 60 },
};
const hourly = {
  hourly: Array.from({ length: 24 }, (_, index) => ({
    time: iso(index + 1), temp: 22, icon: '01d', description: 'açık', pop: 5,
    precipitationMm: 0, windSpeed: 3, apparentTemperature: 22, humidity: 50,
    uvIndex: 1, visibility: 20000, weatherCode: 1,
  })),
  meta: { provider: 'Open-Meteo', attribution: 'Open-Meteo · CC BY 4.0', sourceUrl: 'https://open-meteo.com/', fetchedAt: iso(), timezoneOffsetSeconds: 10800, intervalHours: 1, cacheStatus: 'MISS', freshForSeconds: 300 },
};
const forecast = {
  daily: [{ date: localDate, tempMin: 19, tempMax: 27, icon: '01d', description: 'açık', pop: 5 }],
  hourly: hourly.hourly.filter((_, index) => index % 3 === 0),
  meta: { provider: 'OpenWeather', fetchedAt: iso(), timezoneOffsetSeconds: 10800, intervalHours: 3, cacheStatus: 'MISS', freshForSeconds: 300 },
};



test('320px English dock keeps readable foreground against gradient stops', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await page.setViewportSize({ width: 320, height: 720 });
  for (const themeMode of ['light', 'dark'] as const) {
    await page.addInitScript(theme => {
      localStorage.setItem('user-settings', JSON.stringify({
        language: 'en', themeMode: theme, temperatureUnit: 'metric', windSpeedUnit: 'ms',
      }));
    }, themeMode);
    await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
    await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
    await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: hourly }));
    await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ status: 503, json: {} }));
    await page.route('**/api/v1/weather/context**', route => route.fulfill({ status: 503, json: {} }));
    await page.goto('/istanbul/');
    await page.locator('html').evaluate(element => { element.style.fontSize = '200%'; });
    await expect(page.locator('.hava81-forecast-atlas')).toBeVisible();
    await expect(page.locator('.atlas-forecast-loading--card')).toHaveCount(0);
    // Evaluator-only negative fixture: production DOM and CSS remain unchanged.
    for (const degraded of [false, true]) {
      const result = await page.evaluate((degraded) => {
      const luminance = (value: number) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      };
      const ratio = (a: number[], b: number[]) => {
        const light = (channels: number[]) => channels.map(luminance)
          .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const first = light(a);
        const second = light(b);
        return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
      };
      const rgb = (value: string): number[] | null => {
        const match = value.match(/^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
        return match ? match.slice(1, 4).map(Number) : null;
      };
      const dock = document.querySelector('.atlas-bottom-nav');
      if (!dock) return null;
      const dockGradient = getComputedStyle(dock).backgroundImage;
      const buttons = [...dock.querySelectorAll<HTMLButtonElement>('button')];
      return {
        width: document.documentElement.scrollWidth,
        gradient: dockGradient,
        labels: buttons.map(button => {
          const isActive = button.classList.contains('atlas-bottom-nav__button--active');
          // Negative fixture mutates only the contrast input; it must not alter production DOM/CSS.
          const foreground = degraded && !isActive ? [100, 123, 139] : rgb(getComputedStyle(button).color);
          const background = getComputedStyle(button).backgroundImage;
          // Read current rendered gradients rather than stale theme-specific hardcoded colors.
          // Only fully opaque color stops are comparable; radial/translucent overlays remain unmodeled.
          const gradient = isActive ? background : dockGradient;
          // A translucent radial layer may precede the opaque base linear gradient.
          // Require a real linear base: unrelated radial rgb() colors must never satisfy the guard.
          const linearIndex = gradient.lastIndexOf('linear-gradient(');
          const opaqueBaseGradient = linearIndex < 0 ? '' : gradient.slice(linearIndex);
          const stops = [...opaqueBaseGradient.matchAll(/rgb\((\d+), (\d+), (\d+)\)/g)]
            .map(match => match.slice(1, 4).map(Number));
          // Preserve alpha-stop visibility in reports; alpha composition is outside this test.
          const hasTranslucentStops = /rgba\(/.test(opaqueBaseGradient);
          const rect = button.getBoundingClientRect();
          const labelRect = button.querySelector('.atlas-bottom-nav__label')?.getBoundingClientRect();
          return {
            text: button.textContent?.trim(), active: isActive, background, foregroundCss: getComputedStyle(button).color,
            minBaseStopContrast: foreground && stops.length >= 2 ? Math.min(...stops.map(stop => ratio(foreground, stop))) : 0,
            stopCount: stops.length, hasTranslucentStops, hasLinearBase: linearIndex >= 0,
            targetWidth: rect.width, targetHeight: rect.height,
            labelInside: !!labelRect && labelRect.left >= rect.left - 1 && labelRect.right <= rect.right + 1 &&
              labelRect.top >= rect.top - 1 && labelRect.bottom <= rect.bottom + 1,
          };
        }),
      };
      }, degraded);
    expect(result).not.toBeNull();
    expect(result!.width).toBeLessThanOrEqual(321);
    expect(result!.gradient).toContain('gradient');
    expect(result!.labels).toHaveLength(3);
    for (const label of result!.labels) {
      expect(label.hasLinearBase, `${themeMode} ${label.text} must have an opaque linear base`).toBe(true);
      expect(label.stopCount).toBeGreaterThanOrEqual(2);
      expect(label.hasTranslucentStops, `${themeMode} ${label.text} base gradient needs alpha-aware review`).toBe(false);
      if (degraded && !label.active) {
        expect(label.minBaseStopContrast, `${themeMode} ${label.text} should detect bad contrast`).toBeLessThan(4.5);
      } else {
        expect(label.minBaseStopContrast, `${themeMode} ${label.text} base gradient contrast`).toBeGreaterThanOrEqual(4.5);
      }
      expect(label.targetWidth).toBeGreaterThanOrEqual(44);
      expect(label.targetHeight).toBeGreaterThanOrEqual(44);
      expect(label.labelInside).toBe(true);
    }
      if (!degraded) {
        await page.screenshot({ path: testInfo.outputPath(`dock-contrast-320-zoom200-${themeMode}-baseline.png`), animations: 'disabled' });
      }
    }
  }
});
