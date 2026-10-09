import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { provinceNamesBySlug, provinceCentersBySlug, cityCenterDistanceKm } from './lib/live-audit-city-catalog.mjs';

const auditScript = fileURLToPath(new URL('./audit-live-responsive.mjs', import.meta.url));

function runAuditOptions(args) {
  // Invalid options must fail before launching a browser or contacting the API.
  const result = spawnSync(process.execPath, [auditScript, ...args], {
    encoding: 'utf8',
    timeout: 15_000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
}

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
