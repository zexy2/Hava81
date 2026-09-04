import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const bottomNav = readFileSync('src/components/hava81/AtlasBottomNav.tsx', 'utf8');
const bottomNavCss = readFileSync('src/components/hava81/AtlasBottomNav.css', 'utf8');

describe('bottom navigation current semantics', () => {
  it('marks the active in-page destination as a location and keeps forced-colors aligned', () => {
    expect(bottomNav).toContain("aria-current={isActive ? 'location' : undefined}");
    expect(bottomNav).not.toContain("aria-current={isActive ? 'page' : undefined}");
    expect(bottomNavCss).toContain("[aria-current='location']");
    expect(bottomNavCss).not.toContain("[aria-current='page']");
  });
});
