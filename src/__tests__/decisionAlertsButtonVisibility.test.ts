import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/components/hava81/DecisionAlertVisualPolish.css', 'utf8');
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
};

describe('decision alerts button (Faz 0.4)', () => {
  it('sets an explicit text colour so it never renders white on white', () => {
    expect(rule('.app .decision-alerts button')).toMatch(/(^|;|\s)color:\s*var\(--premium-blue\)/);
  });

  it('shows the blocked/disabled state without relying on opacity alone', () => {
    const disabled = rule('.app .decision-alerts button:disabled');
    expect(disabled).toMatch(/color:\s*var\(--color-atlas-muted\)/);
    expect(disabled).toMatch(/border-style:\s*dashed/);
    expect(disabled).toMatch(/opacity:\s*1/);
  });
});
