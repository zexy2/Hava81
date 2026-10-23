import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

describe('production HTML build order', () => {
  it('generates localized pages and applies CSP before stamping the service-worker shell cache', () => {
    const build = packageJson.scripts.build;
    const generate = build.indexOf('scripts/generate-city-pages.mjs');
    const csp = build.indexOf('scripts/apply-csp.mjs');
    const stamp = build.indexOf('scripts/stamp-service-worker.mjs');
    expect(generate).toBeGreaterThan(-1);
    expect(csp).toBeGreaterThan(generate);
    expect(stamp).toBeGreaterThan(csp);
  });
});
