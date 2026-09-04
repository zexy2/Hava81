import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('offscreen decision panel containment', () => {
  it('keeps commute and route tools mounted while allowing offscreen rendering work to be skipped', () => {
    const css = readFileSync('src/styles/offscreen-panels.css', 'utf8');

    expect(css).toMatch(
      /\.atlas-dashboard > \.commute-plan\s*\{[\s\S]*?content-visibility:\s*auto;[\s\S]*?contain-intrinsic-size:\s*auto 28rem;/
    );
    expect(css).toMatch(
      /\.atlas-dashboard > \.route-weather\s*\{[\s\S]*?content-visibility:\s*auto;[\s\S]*?contain-intrinsic-size:\s*auto 7rem;/
    );
  });
});
