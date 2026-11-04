import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  DEFAULT_API_ORIGIN,
  MAP_TILE_ORIGINS,
  mapOriginFrom,
  apiOriginFrom,
  applyCspToDist,
  applyCspToHtml,
  buildCsp,
  inlineScriptHashes,
} from './apply-csp.mjs';

const bootstrap = "\n      (() => { window.__HAVA81_BOOTSTRAP_WEATHER__ = {}; })();\n    ";
const page = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <script type="application/ld+json">{"@type":"WebSite"}</script>
    <script>${bootstrap}</script>
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`;

const cspOf = html => {
  const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)" \/>/);
  assert.ok(match, 'CSP meta missing');
  return match[1];
};
const directive = (csp, name) =>
  csp
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name} `));

test('hashes only inline executable scripts', () => {
  const expected = `'sha256-${createHash('sha256').update(bootstrap, 'utf8').digest('base64')}'`;
  assert.deepEqual(inlineScriptHashes(page), [expected]);
});

test('API origin comes from absolute VITE_API_BASE_URL only', () => {
  assert.equal(apiOriginFrom('https://api.example.test/api/v1'), 'https://api.example.test');
  assert.equal(apiOriginFrom('/api/v1'), null);
  assert.equal(apiOriginFrom(undefined), null);
});

test('policy allows exactly the app origins', () => {
  const csp = buildCsp({ scriptHashes: ["'sha256-x'"], apiOrigin: 'https://api.example.test' });
  assert.equal(directive(csp, 'default-src'), "default-src 'self'");
  assert.equal(directive(csp, 'script-src'), "script-src 'self' 'sha256-x'");
  assert.equal(
    directive(csp, 'connect-src'),
    `connect-src 'self' data: ${DEFAULT_API_ORIGIN} ${MAP_TILE_ORIGINS.join(' ')} https://api.example.test`
  );
  // MapLibre fetches the OpenFreeMap style and tiles, and reads the locally drawn weather
  // field (a data: image) with fetch; its worker is a same-origin file.
  assert.deepEqual(MAP_TILE_ORIGINS, ['https://tiles.openfreemap.org']);
  // Exact source match, not a regular expression: a host is an exact token in the directive.
  for (const origin of MAP_TILE_ORIGINS) assert.ok(directive(csp, 'img-src').split(' ').includes(origin));
  assert.equal(directive(csp, 'worker-src'), "worker-src 'self'");
  assert.equal(directive(csp, 'object-src'), "object-src 'none'");
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.doesNotMatch(directive(csp, 'script-src'), /unsafe-inline/);
});

test('meta is placed right after charset, before any script, and is idempotent', () => {
  const once = applyCspToHtml(page, { apiOrigin: null });
  const twice = applyCspToHtml(once, { apiOrigin: null });
  assert.equal(twice, once);
  assert.equal(once.match(/Content-Security-Policy/g).length, 1);
  const metaIndex = once.indexOf('Content-Security-Policy');
  assert.ok(metaIndex > once.indexOf('<meta charset'));
  assert.ok(metaIndex < once.indexOf('<script'));
  assert.match(directive(cspOf(once), 'script-src'), /'sha256-/);
});

test('applies to every HTML file in dist', async t => {
  const dist = await mkdtemp(join(tmpdir(), 'hava81-csp-'));
  t.after(() => rm(dist, { recursive: true, force: true }));
  await mkdir(join(dist, 'istanbul'), { recursive: true });
  await writeFile(join(dist, 'index.html'), page.replace(/<script>[\s\S]*?<\/script[^>]*>/i, ''));
  await writeFile(join(dist, 'istanbul', 'index.html'), page);
  await writeFile(join(dist, 'app.js'), 'console.log(1)');

  const count = await applyCspToDist(dist, { apiBaseUrl: 'https://api.hava81.zekiakgul.dev/api/v1' });
  assert.equal(count, 2);
  const home = cspOf(await readFile(join(dist, 'index.html'), 'utf8'));
  const city = cspOf(await readFile(join(dist, 'istanbul', 'index.html'), 'utf8'));
  assert.equal(directive(home, 'script-src'), "script-src 'self'");
  assert.match(directive(city, 'script-src'), /^script-src 'self' 'sha256-[A-Za-z0-9+/=]+'$/);
  assert.equal(await readFile(join(dist, 'app.js'), 'utf8'), 'console.log(1)');
});

test('#1757 a configured map host replaces OpenFreeMap in the policy, and only that host', () => {
  const csp = buildCsp({ mapOrigin: 'https://tiles.example.test' });
  assert.match(directive(csp, 'connect-src'), /https:\/\/tiles\.example\.test/);
  assert.match(directive(csp, 'img-src'), /https:\/\/tiles\.example\.test/);
  assert.doesNotMatch(csp, /tiles\.openfreemap\.org/);
  // Without one, the default stays OpenFreeMap.
  assert.match(directive(buildCsp(), 'connect-src'), /tiles\.openfreemap\.org/);
  // A relative or malformed value is ignored rather than opening the policy.
  assert.equal(mapOriginFrom('/tiles'), null);
  assert.equal(mapOriginFrom('not a url'), null);
  assert.equal(mapOriginFrom('https://tiles.example.test/styles'), 'https://tiles.example.test');
});
