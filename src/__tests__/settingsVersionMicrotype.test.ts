import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/components/SettingsPanel.css', 'utf8');

describe('settings version microtype', () => {
  it('keeps version metadata at the functional-copy floor', () => {
    const version = css.match(/\.settings-panel__version\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(version).toMatch(/font-size:\s*0\.8125rem/);
  });
});
