import { defineConfig, devices } from '@playwright/test';

const DEFAULT_PREVIEW_PORT = 4173;
const requestedPreviewPort = Number(process.env.HAVA81_PLAYWRIGHT_PORT);
const previewPort =
  Number.isInteger(requestedPreviewPort) &&
  requestedPreviewPort >= 1024 &&
  requestedPreviewPort <= 65535
    ? requestedPreviewPort
    : DEFAULT_PREVIEW_PORT;
const previewUrl = `http://127.0.0.1:${previewPort}`;

// Tests tagged @mobile / @tablet / @desktop run only in that project; untagged
// tests run in all three (see e2e/helpers/test.ts). Screenshot comparisons are
// tagged @visual and only run in the opt-in `visual` project because their
// baselines must be generated on CI Linux (see docs/IYILESTIRME_PLANI.md, 3.x).
const UNTAGGED = /^(?!.*@(?:mobile|tablet|desktop)\b)/;
const projectFilter = (tag: 'mobile' | 'tablet' | 'desktop') => ({
  grep: [new RegExp(`@${tag}\\b`), UNTAGGED],
  grepInvert: /@visual\b/,
});
const visualProjects =
  process.env.HAVA81_VISUAL === '1'
    ? [
        {
          name: 'visual',
          grep: /@visual\b/,
          use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
        },
      ]
    : [];

export default defineConfig({
  testDir: './e2e',
  // Keep disposable Playwright output separate from stable Watchdog screenshots.
  outputDir: './test-results/playwright-runs',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: previewUrl,
    // The app now follows the device (Faz 0.7); pin the primary audience's defaults.
    locale: 'tr-TR',
    colorScheme: 'light',
    trace: 'on-first-retry',
    // Use an already-installed system browser on remote QA hosts when supplied.
    // CI keeps Playwright's managed browser by default.
    ...(process.env.HAVA81_CHROMIUM_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.HAVA81_CHROMIUM_EXECUTABLE_PATH } }
      : {}),
  },
  projects: [
    {
      name: 'mobile-390',
      ...projectFilter('mobile'),
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'tablet-768',
      ...projectFilter('tablet'),
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop-1280',
      ...projectFilter('desktop'),
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    ...visualProjects,
  ],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${previewPort}`,
    url: previewUrl,
    reuseExistingServer: false,
  },
});
