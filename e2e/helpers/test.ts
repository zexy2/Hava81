import { test as base, expect } from '@playwright/test';
import { mockWeatherApi } from './weather-fixtures';

/**
 * Project tags. playwright.config.ts routes tagged tests to a single project:
 * `@mobile` → mobile-390, `@tablet` → tablet-768, `@desktop` → desktop-1280.
 * Untagged tests run in all three projects. `@visual` tests only run in the
 * opt-in `visual` project (HAVA81_VISUAL=1).
 *
 * Tagging (instead of `test.skip(project !== …)` inside the body) keeps the
 * test list honest and avoids opening a page for tests that are skipped.
 */
export const MOBILE = { tag: '@mobile' } as const;
export const TABLET = { tag: '@tablet' } as const;
export const DESKTOP = { tag: '@desktop' } as const;
export const VISUAL = { tag: '@visual' } as const;

type Options = {
  /** Set to false (`test.use({ mockApi: false })`) to install custom mocks yourself. */
  mockApi: boolean;
};

export const test = base.extend<Options & { _apiMocks: void }>({
  mockApi: [true, { option: true }],
  _apiMocks: [
    async ({ page, mockApi }, use) => {
      if (mockApi) await mockWeatherApi(page);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
