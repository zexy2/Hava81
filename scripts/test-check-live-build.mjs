import assert from 'node:assert/strict';
import test from 'node:test';
import { compareShells, shellAssets } from './check-live-build.mjs';

test('asset comparison ignores order, ignores non-boot links and normalizes paths', () => {
  const html = '<link rel="stylesheet" href="/assets/a.css"><script type="module" src="/assets/b.js"></script><link href="/manifest.json">';
  assert.deepEqual(shellAssets(html), ['/assets/a.css', '/assets/b.js']);
  assert.equal(compareShells(html, '<script src="/assets/b.js"></script><link href="/assets/a.css">').matches, true);
});
test('different JS hash is reported as a drift', () => {
  const result = compareShells('<script src="/assets/index-new.js"></script>', '<script src="/assets/index-old.js"></script>');
  assert.equal(result.matches, false);
});
