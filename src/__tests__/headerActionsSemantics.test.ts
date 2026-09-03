import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/App.tsx', 'utf8');

describe('header quick-action semantics', () => {
  it('exposes action buttons as a named group instead of a navigation landmark', () => {
    expect(source).toContain('className="atlas-header__actions"\n                role="group"');
    expect(source).not.toContain('<nav className="atlas-header__actions"');
  });
});
