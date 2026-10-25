import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveLighthouseTargetUrl } from './lib/lighthouse-target-url.mjs';

const origin = 'http://127.0.0.1:4173';
assert.equal(
  resolveLighthouseTargetUrl(undefined, origin),
  `${origin}/index.html`,
  'the existing homepage target remains the safe default'
);
assert.equal(
  resolveLighthouseTargetUrl('/istanbul/', origin),
  `${origin}/istanbul/`,
  'the actual Turkish city route can be measured'
);
assert.equal(
  resolveLighthouseTargetUrl('/en/istanbul/?view=map', origin),
  `${origin}/en/istanbul/?view=map`,
  'language-specific city routes and view query strings are preserved'
);
for (const path of ['istanbul/', '//example.com/', 'https://example.com/', '/istanbul/#map']) {
  assert.throws(
    () => resolveLighthouseTargetUrl(path, origin),
    /HAVA81_LIGHTHOUSE_PATH/,
    `unsafe or ambiguous target should be rejected: ${path}`
  );
}

const runner = await readFile(new URL('./run-lighthouse.mjs', import.meta.url), 'utf8');
assert.match(runner, /process\.env\.HAVA81_LIGHTHOUSE_PATH/);
assert.match(runner, /resolveLighthouseTargetUrl/);
console.log('Lighthouse target-path contract: PASS');
