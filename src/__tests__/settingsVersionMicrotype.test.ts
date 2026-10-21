import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

const css = readCss('src/components/SettingsPanel.css');

describe('settings version microtype', () => {
  it('keeps version metadata at the functional-copy floor', () => {
    const version = css.match(/(?:^|\n)\.settings-panel__version\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(version).toMatch(/font-size:\s*0\.8125rem/);
  });
});
