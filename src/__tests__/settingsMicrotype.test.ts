import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/components/SettingsPanel.css', 'utf8');

const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
};

describe('Settings functional microtype', () => {
  it('keeps language flag cues at or above the 13px-equivalent floor', () => {
    const match = rule('.settings-option__flag').match(/font-size:\s*([0-9.]+)rem/);
    expect(match).not.toBeNull();
    expect(Number.parseFloat(match?.[1] ?? '0')).toBeGreaterThanOrEqual(0.8125);
  });
});
