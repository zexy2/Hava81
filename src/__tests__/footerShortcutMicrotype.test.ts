import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

const css = readCss('src/styles/App.css');

describe('footer shortcut microtype', () => {
  it('keeps footer guidance and keyboard-key labels at the functional-copy floor', () => {
    const footer = css.match(/\.atlas-footer\s*\{([^}]*)\}/)?.[1] ?? '';
    const key = css.match(/(?:^|\n)kbd\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(footer).toMatch(/font-size:\s*0\.8125rem/);
    expect(key).toMatch(/font:\s*500\s+0\.8125rem\/1\.4/);
  });
});
