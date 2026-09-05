import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('header compare action semantics', () => {
  it('exposes the saved comparison view as current navigation, not a pressed toggle', () => {
    const source = readFileSync('src/App.tsx', 'utf8');

    expect(source).toContain("className=\"atlas-compare-button\"");
    expect(source).toContain("aria-current={activeNav === 'compare' ? 'location' : undefined}");
    expect(source).not.toContain("aria-current={activeNav === 'compare' ? 'page' : undefined}");

    const css = readFileSync('src/styles/App.css', 'utf8');
    expect(css).toContain(".atlas-compare-button[aria-current='location']");
    expect(css).not.toContain(".atlas-compare-button[aria-pressed='true']");
  });
});
