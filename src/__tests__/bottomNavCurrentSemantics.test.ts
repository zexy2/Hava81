import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const bottomNav = readFileSync('src/components/hava81/AtlasBottomNav.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

describe('in-page navigation current semantics', () => {
  it('marks the active in-page destination as a location rather than a page', () => {
    expect(bottomNav).toContain("aria-current={isActive ? 'location' : undefined}");
    expect(bottomNav).not.toContain("aria-current={isActive ? 'page' : undefined}");
    expect(app).toContain("aria-current={activeNav === 'saved' ? 'location' : undefined}");
  });
});
