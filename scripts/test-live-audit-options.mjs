import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { provinceNamesBySlug, provinceCentersBySlug, cityCenterDistanceKm } from './lib/live-audit-city-catalog.mjs';
import { parseLoopbackCdpUrl, resolveLoopbackCdpPort } from './lib/loopback-cdp-url.mjs';
import { LIVE_AUDIT_INTERACTIVE_TARGET_SELECTOR, LIVE_AUDIT_INTERACTIVE_TARGET_SELECTORS } from './lib/live-audit-target-selector.mjs';

const auditScript = fileURLToPath(new URL('./audit-live-responsive.mjs', import.meta.url));
const captureScript = fileURLToPath(new URL('./capture-visual-audit.mjs', import.meta.url));
const forecastHelper = fileURLToPath(new URL('./lib/activate-deferred-forecast.mjs', import.meta.url));

function runAuditOptions(args) {
  // Invalid options must fail before launching a browser or contacting the API.
  const result = spawnSync(process.execPath, [auditScript, ...args], {
    encoding: 'utf8',
    timeout: 15_000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
}


test('shared Chrome DevTools configuration accepts only explicit loopback HTTP endpoints', async t => {
  for (const value of ['http://127.0.0.1:9222', 'http://localhost:9222/', 'http://[::1]:9222']) {
    await t.test(value, () => {
      const origin = parseLoopbackCdpUrl(value);
      assert.equal(new URL(origin).protocol, 'http:');
      assert.equal(resolveLoopbackCdpPort(value), 9222);
    });
  }

  for (const value of [
    '',
    'not-a-url',
    'https://127.0.0.1:9222',
    'http://127.0.0.1',
    'http://example.com:9222',
    'http://127.0.0.1:9222/devtools',
    'http://user:pass@127.0.0.1:9222',
    'http://127.0.0.1:9222/?token=secret',
    'http://127.0.0.1:9222/#fragment',
  ]) {
    await t.test(`rejects ${JSON.stringify(value)}`, () => {
      assert.throws(() => parseLoopbackCdpUrl(value), /HAVA81_CHROMIUM_CDP_URL/);
    });
  }
});

test('live audit refuses empty, malformed or non-URL-safe city lists', async t => {
  for (const cities of [',', ',,', 'izmir,,sanliurfa', '-izmir', 'izmir-', 'izmir, -']) {
    await t.test(JSON.stringify(cities), () => {
      const result = runAuditOptions(['--quick', '--cities', cities]);
      assert.notEqual(result.status, 0, 'invalid city list must never pass');
      assert.match(result.stderr, /Cities must be a non-empty, comma-separated list of URL-safe slugs/);
      assert.doesNotMatch(result.stdout, /Starting read-only audit/);
    });
  }
});

test('live touch-target audit includes primary links but excludes inline attribution links', () => {
  for (const selector of [
    'button', '[role="button"]', 'input', 'select', '[role="tab"]',
    'a.atlas-button', 'a.atlas-brand', 'a.decision-glance__details', 'nav a[href]',
  ]) {
    assert.ok(LIVE_AUDIT_INTERACTIVE_TARGET_SELECTORS.includes(selector), 'missing ' + selector);
  }
  assert.equal(LIVE_AUDIT_INTERACTIVE_TARGET_SELECTOR, LIVE_AUDIT_INTERACTIVE_TARGET_SELECTORS.join(','));
  assert.ok(!LIVE_AUDIT_INTERACTIVE_TARGET_SELECTORS.includes('a[href]'), 'ordinary inline links must not be treated as buttons');

  const headerSource = readFileSync(new URL('../src/components/app/AppHeader.tsx', import.meta.url), 'utf8');
  const notFoundSource = readFileSync(new URL('../src/components/app/NotFoundState.tsx', import.meta.url), 'utf8');
  const decisionSource = readFileSync(new URL('../src/components/hava81/DecisionGlance.tsx', import.meta.url), 'utf8');
  assert.ok(headerSource.includes('className="atlas-brand"'), 'brand selector must match the real home link');
  assert.ok(notFoundSource.includes('className="atlas-button"'), 'button-link selector must match the real recovery link');
  assert.ok(decisionSource.includes('className="decision-glance__details"'), 'details selector must match the primary decision action');
});

test('live audit help exits successfully without starting an audit', () => {
  const result = runAuditOptions(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: npm run audit:live-ui/);
  assert.doesNotMatch(result.stdout, /Starting read-only audit/);
});

test('live audit rejects unsupported language and theme before browser startup', () => {
  for (const args of [['--languages', 'xx'], ['--themes', 'neon']]) {
    const result = runAuditOptions(args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must be one or more of:/);
    assert.doesNotMatch(result.stdout, /Starting read-only audit/);
  }
});


test('live audit derives every canonical province name from the route catalog', () => {
  assert.equal(provinceNamesBySlug.size, 81);
  assert.equal(provinceNamesBySlug.get('izmir'), 'İzmir');
  assert.equal(provinceNamesBySlug.get('sanliurfa'), 'Şanlıurfa');
  assert.equal(provinceNamesBySlug.get('canakkale'), 'Çanakkale');
  assert.equal(provinceNamesBySlug.get('ankara'), 'Ankara');
  assert.equal(provinceNamesBySlug.get('kahramanmaras'), 'Kahramanmaraş');
});

test('live audit refuses unknown but syntactically valid cities before browser startup', async t => {
  for (const cities of ['izmri', 'izmir,imaginary-city', 'unknown-city,sanliurfa']) {
    await t.test(cities, () => {
      const result = runAuditOptions(['--quick', '--cities', cities]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Unknown Turkish province slug\(s\):/);
      assert.doesNotMatch(result.stdout, /Starting read-only audit/);
    });
  }
});

test('all 81 province release checks have canonical and valid center coordinates', () => {
  assert.equal(provinceCentersBySlug.size, 81);
  for (const [slug, name] of provinceNamesBySlug) {
    const center = provinceCentersBySlug.get(slug);
    assert.ok(center, `Missing center for ${name}`);
    assert.ok(Number.isFinite(center.lat) && Number.isFinite(center.lon), `Invalid center for ${name}`);
    assert.equal(cityCenterDistanceKm(slug, center), 0, `Expected zero distance for ${name}`);
  }
});

test('release gate rejects another province weather even when it contains valid numeric data', () => {
  const izmir = provinceCentersBySlug.get('izmir');
  const istanbul = provinceCentersBySlug.get('istanbul');
  assert.ok(cityCenterDistanceKm('izmir', istanbul) > 300);
  assert.ok(cityCenterDistanceKm('izmir', { lat: izmir.lat + 0.12, lon: izmir.lon }) < 100);
  assert.equal(cityCenterDistanceKm('unknown', izmir), Number.POSITIVE_INFINITY);
  assert.equal(cityCenterDistanceKm('izmir', { lat: NaN, lon: izmir.lon }), Number.POSITIVE_INFINITY);
  assert.equal(cityCenterDistanceKm('izmir', { lat: 91, lon: 0 }), Number.POSITIVE_INFINITY);
});

test('live and screenshot audits share deferred-forecast activation before measuring', () => {
  const liveSource = readFileSync(auditScript, 'utf8');
  const captureSource = readFileSync(captureScript, 'utf8');
  const helperSource = readFileSync(forecastHelper, 'utf8');

  assert.ok(liveSource.includes('activateDeferredForecast(page)'));
  assert.ok(captureSource.includes('activateDeferredForecast(page'));
  assert.ok(captureSource.includes('restoreViewportTop(page)'));

  const activate = helperSource.indexOf('scrollIntoView');
  const settled = helperSource.indexOf("await forecastContent.waitFor({ state: 'visible', timeout });", activate);
  const restoreTop = helperSource.indexOf("window.scrollTo({ top: 0, behavior: 'auto' })");
  assert.ok(activate >= 0, 'the deferred forecast placeholder must be approached to trigger lazy loading');
  assert.ok(settled > activate, 'the helper must wait for the chart or visible error state after activation');
  assert.ok(restoreTop >= 0, 'the helper must restore the first viewport after activation');
  assert.ok(
    captureSource.indexOf('await activateDeferredForecast(page') < captureSource.indexOf('const snapshot=await page.evaluate'),
    'visual geometry must be measured after the deferred chart is activated',
  );
});
