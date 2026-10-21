import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

const css = readCss('src/components/SettingsPanel.css');

const rule = (selector: string) => {
  // Anchored to a line start: the component's own rule, not an `.app …` override (Faz 2.1).
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
};

describe('Settings functional microtype', () => {
  it('keeps language flag cues at or above the 13px-equivalent floor', () => {
    const match = rule('.settings-option__flag').match(/font-size:\s*([0-9.]+)rem/);
    expect(match).not.toBeNull();
    expect(Number.parseFloat(match?.[1] ?? '0')).toBeGreaterThanOrEqual(0.8125);
  });
});
