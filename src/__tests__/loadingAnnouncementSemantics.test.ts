import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('loading announcement semantics', () => {
  it('announces the loading copy as one polite atomic status', () => {
    const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    expect(source).toContain('className=\"atlas-loading\" role=\"status\" aria-live=\"polite\" aria-atomic=\"true\"');
  });
});
