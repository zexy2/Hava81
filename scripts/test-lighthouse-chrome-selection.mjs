import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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
const runnerPath = fileURLToPath(new URL('./run-lighthouse.mjs', import.meta.url));
assert.match(runner, /resolveLighthouseChromePath/);
assert.match(runner, /import\('playwright'\)/);
assert.match(runner, /runEnv\.CHROME_PATH = chromePath/);
assert.match(runner, /HAVA81_CHROMIUM_CDP_URL/);
assert.match(runner, /resolveLoopbackCdpPort/);
assert.match(runner, /--port=\$\{cdpPort\}/);
assert.match(runner, /connecting to existing loopback Chrome DevTools port/);
console.log('Lighthouse browser-selection contract: PASS');

for (const [label, env, expectedError] of [
  [
    'reject remote CDP endpoints before preview startup',
    { HAVA81_CHROMIUM_CDP_URL: 'https://example.com:9222' },
    /HAVA81_CHROMIUM_CDP_URL/,
  ],
  [
    'reject a CDP/preview port collision before preview startup',
    { HAVA81_CHROMIUM_CDP_URL: 'http://127.0.0.1:9222', HAVA81_LIGHTHOUSE_PORT: '9222' },
    /must differ from the local Lighthouse preview port/,
  ],
]) {
  const result = spawnSync(process.execPath, [runnerPath], {
    encoding: 'utf8',
    timeout: 5_000,
    env: { ...process.env, ...env },
  });
  assert.notEqual(result.status, 0, label);
  assert.match(result.stderr, expectedError, label);
  assert.doesNotMatch(result.stdout, /\[lighthouse\] target/, label);
}
console.log('Lighthouse CDP validation contract: PASS');
