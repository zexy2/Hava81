import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { provinceNamesBySlug } from './lib/live-audit-city-catalog.mjs';

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
