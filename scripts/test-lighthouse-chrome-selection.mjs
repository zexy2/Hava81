import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveLighthouseChromePath } from './lib/resolve-lighthouse-chrome.mjs';

const neverAccess = async () => {
  throw new Error('must not probe an explicit operator override');
};
assert.equal(
  await resolveLighthouseChromePath({
    configuredPath: '/custom/chrome',
    playwrightExecutablePath: '/playwright/chrome',
    canAccess: neverAccess,
  }),
  '/custom/chrome',
  'explicit CHROME_PATH must win without probing alternatives'
);
assert.equal(
  await resolveLighthouseChromePath({
    playwrightExecutablePath: '/playwright/chrome',
    canAccess: async path => assert.equal(path, '/playwright/chrome'),
  }),
  '/playwright/chrome',
  'an installed Playwright browser should be selected when no override exists'
);
assert.equal(
  await resolveLighthouseChromePath({
    playwrightExecutablePath: '/missing/chrome',
    canAccess: async () => { throw new Error('ENOENT'); },
  }),
  undefined,
  'a missing Playwright browser must fall back to chrome-launcher discovery'
);
assert.equal(
  await resolveLighthouseChromePath({ canAccess: neverAccess }),
  undefined,
  'absence of both browser choices must preserve normal discovery'
);

const runner = await readFile(new URL('./run-lighthouse.mjs', import.meta.url), 'utf8');
assert.match(runner, /resolveLighthouseChromePath/);
assert.match(runner, /import\('playwright'\)/);
assert.match(runner, /CHROME_PATH: chromePath/);
console.log('Lighthouse browser-selection contract: PASS');
