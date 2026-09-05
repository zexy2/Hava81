import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/App.tsx', 'utf8');

describe('header quick-action semantics', () => {
  it('exposes action buttons as a named group instead of a navigation landmark', () => {
    expect(source).toContain('className="atlas-header__actions"\n                role="group"');
    expect(source).not.toContain('<nav className="atlas-header__actions"');
  });

  it('does not offer the map header action before current weather exists', () => {
    expect(source).toContain('className="atlas-icon-button atlas-icon-button--map"');
    expect(source).toContain('onClick={showMap ? closeMap : openMap}\n                  disabled={!weather}');
  });
});
