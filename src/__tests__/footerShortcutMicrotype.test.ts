import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/App.css', 'utf8');

describe('footer shortcut microtype', () => {
  it('keeps footer guidance and keyboard-key labels at the functional-copy floor', () => {
    const footer = css.match(/\.atlas-footer\s*\{([^}]*)\}/)?.[1] ?? '';
    const key = css.match(/(?:^|\n)kbd\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(footer).toMatch(/font-size:\s*0\.8125rem/);
    expect(key).toMatch(/font:\s*500\s+0\.8125rem\/1\.4/);
  });
});
