import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('header compare action semantics', () => {
  it('exposes the saved comparison view as a pressed button, not a navigation location', () => {
    const source = readFileSync('src/App.tsx', 'utf8');

    expect(source).toContain("className=\"atlas-compare-button\"");
    expect(source).toContain("aria-pressed={activeNav === 'saved'}");
    expect(source).not.toContain("aria-current={activeNav === 'saved' ? 'location' : undefined}");
  });
});
