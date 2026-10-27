import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import { expectNoHorizontalScroll, expectReadable, setTextScale, setWidth } from './helpers/layout';

const installBlockedNotificationPermission = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'denied', requestPermission: async () => 'denied' },
    });
  });
};

const contrastRatio = async (button: import('@playwright/test').Locator) =>
  button.evaluate((element) => {
    const style = getComputedStyle(element);
    const linearize = (srgb: number) =>
      srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    const linearRgb = (value: string): number[] => {
      const oklab = value.match(/oklab\(\s*([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s*\)/i);
      if (oklab) {
        const [lightness, a, b] = oklab.slice(1, 4).map(Number);
        const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
        const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
        const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
        const l = lRoot ** 3;
        const m = mRoot ** 3;
        const s = sRoot ** 3;
        return [
          4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
        ].map((channel) => Math.max(0, Math.min(1, channel)));
      }

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D is unavailable for color normalization');
      context.fillStyle = '#000';
      context.fillStyle = value;
      const normalized = context.fillStyle;
      const hex = normalized.match(/^#([0-9a-f]{3,8})$/i)?.[1];
      if (hex && (hex.length === 3 || hex.length === 4)) {
        return hex.slice(0, 3).split('').map((channel) => linearize(parseInt(channel + channel, 16) / 255));
      }
      if (hex && (hex.length === 6 || hex.length === 8)) {
        return [0, 2, 4].map((offset) => linearize(parseInt(hex.slice(offset, offset + 2), 16) / 255));
      }
      const srgb = normalized.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
      if (srgb) return srgb.slice(1, 4).map((channel) => linearize(Number(channel)));
      const rgb = normalized.match(/rgba?\(([^)]+)\)/i);
      if (rgb) {
        return rgb[1]
          .split(/[\s,/]+/)
          .filter(Boolean)
          .slice(0, 3)
          .map((channel) => linearize(Number(channel) / 255));
      }
      throw new Error(`Unsupported computed CSS color: ${normalized}`);
    };
    const luminance = (value: string) => {
      const [red, green, blue] = linearRgb(value);
      return red * 0.2126 + green * 0.7152 + blue * 0.0722;
    };
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });

test('blocked notification action stays WCAG-readable in light and dark themes', DESKTOP, async ({ page }) => {
  await installBlockedNotificationPermission(page);
  await page.goto('/istanbul/?view=plan');
  await page.locator('.atlas-deferred-alerts-slot').focus();
  await expect(page.locator('.decision-alerts')).toBeVisible();

  const panel = page.locator('.decision-alerts');
  const button = panel.locator('button');
  // The panel is inside the Plan view and uses content-visibility:auto. Override
  // only that optimization so the test measures the component styles regardless
  // of viewport activation; the button's own styles remain untouched.
  await panel.evaluate((element) => { element.style.contentVisibility = 'visible'; });
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
  await expect(button).toContainText(/bildirim/i);
  await expect(button).toHaveAttribute('aria-describedby', 'decision-alerts-permission-help');
  // DecisionAlertsPanel is lazy-loaded; wait for its split stylesheet before measuring contrast.
  await expect(button).toHaveCSS('opacity', '1');

  for (const mode of ['light', 'dark'] as const) {
    await page.locator('.app').evaluate((element, colorMode) => {
      element.setAttribute('data-color-mode', colorMode);
    }, mode);
    await expect.poll(() => contrastRatio(button)).toBeGreaterThanOrEqual(4.5);
  }
});

test('blocked notification action fits 320px and 200% text without horizontal overflow', MOBILE, async ({ page }) => {
  await installBlockedNotificationPermission(page);
  await page.goto('/istanbul/?view=plan');
  await page.locator('.atlas-deferred-alerts-slot').focus();
  await expect(page.locator('.decision-alerts')).toBeVisible();

  const panel = page.locator('.decision-alerts');
  const button = panel.locator('button');
  await panel.evaluate((element) => { element.style.contentVisibility = 'visible'; });
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
  await expect(button).toContainText(/bildirim/i);

  await setWidth(page, 320, 844);
  await setTextScale(page, 200);
  await expectReadable(page, button, 'blocked notification action at 320px/200%');
  await expectNoHorizontalScroll(page, 'blocked notification action at 320px/200%');
  const dimensions = await button.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    right: element.getBoundingClientRect().right,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(dimensions.right).toBeLessThanOrEqual(321);
});

test.describe('blocked notification panel axe audit', () => {
  // axe-core is injected inline by Playwright; scope the CSP bypass to this test-only audit.
  // The production Content-Security-Policy remains strict and is not changed by this fixture.
  test.use({ bypassCSP: true });

  test(
    'blocked notification panel has no axe WCAG A/AA or best-practice violations across themes and locales',
    DESKTOP,
  async ({ page }) => {
    await installBlockedNotificationPermission(page);

    for (const variant of [
      { width: 320, language: 'tr', themeMode: 'light', path: '/izmir/?view=plan' },
      { width: 390, language: 'en', themeMode: 'dark', path: '/en/istanbul/?view=plan' },
      { width: 1280, language: 'tr', themeMode: 'dark', path: '/istanbul/?view=plan' },
    ] as const) {
      await page.setViewportSize({ width: variant.width, height: 900 });
      await page.goto('/istanbul/');
      await page.evaluate(({ language, themeMode }) => {
        localStorage.setItem(
          'user-settings',
          JSON.stringify({
            temperatureUnit: 'metric',
            windSpeedUnit: 'ms',
            language,
            themeMode,
          })
        );
      }, variant);
      await page.goto(variant.path);
      await page.locator('.atlas-deferred-alerts-slot').focus();

      const panel = page.locator('.decision-alerts');
      await expect(panel).toBeVisible();
      await panel.evaluate(element => {
        element.style.contentVisibility = 'visible';
      });
      await expect(panel.locator('button')).toBeDisabled();
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });

      const failures = await page.evaluate(async () => {
        const axe = (
          window as unknown as Window & {
            axe: {
              run: (
                root: Element,
                options: unknown
              ) => Promise<{
                violations: Array<{
                  id: string;
                  impact: string | null;
                  help: string;
                  nodes: Array<{ target: string[] }>;
                }>;
              }>;
            };
          }
        ).axe;
        const root = document.querySelector('.decision-alerts');
        if (!(root instanceof HTMLElement)) throw new Error('Decision alerts panel is missing');
        const result = await axe.run(root, {
          runOnly: {
            type: 'tag',
            values: [
              'wcag2a',
              'wcag2aa',
              'wcag21a',
              'wcag21aa',
              'wcag22aa',
              'best-practice',
            ],
          },
        });
        return result.violations.flatMap(violation =>
          violation.nodes.map(
            node =>
              `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help} — ${node.target.join(', ')}`
          )
        );
      });

      expect(
        failures,
        `decision alerts panel at ${variant.width}px (${variant.language}, ${variant.themeMode})`
      ).toEqual([]);
      await expectNoHorizontalScroll(page, 'decision alerts panel');
    }
  }
  );
});
