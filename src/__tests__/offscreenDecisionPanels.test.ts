import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

describe('offscreen decision panel containment', () => {
  it('keeps commute and route tools mounted while allowing offscreen rendering work to be skipped', () => {
    const css = readCss('src/styles/offscreen-panels.css');

    expect(css).toMatch(
      /\.atlas-dashboard \.commute-plan\s*\{[\s\S]*?content-visibility:\s*auto;[\s\S]*?contain-intrinsic-size:\s*auto 28rem;/
    );
    expect(css).toMatch(
      /\.atlas-dashboard \.route-weather\s*\{[\s\S]*?content-visibility:\s*auto;[\s\S]*?contain-intrinsic-size:\s*auto 7rem;/
    );
  });
});
