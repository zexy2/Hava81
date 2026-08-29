import { defineConfig, devices } from '@playwright/test';

const DEFAULT_PREVIEW_PORT = 4173;
const requestedPreviewPort = Number(process.env.HAVA81_PLAYWRIGHT_PORT);
const previewPort =
  Number.isInteger(requestedPreviewPort) && requestedPreviewPort >= 1024 && requestedPreviewPort <= 65535
    ? requestedPreviewPort
    : DEFAULT_PREVIEW_PORT;
const previewUrl = `http://127.0.0.1:${previewPort}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: previewUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-390',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'tablet-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${previewPort}`,
    url: previewUrl,
    reuseExistingServer: false,
  },
});
