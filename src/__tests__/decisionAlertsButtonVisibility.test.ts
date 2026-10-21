import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

const css = readCss('src/components/hava81/DecisionAlertsPanel.css');
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Last match: the alerts visual pass is the final section of the stylesheet (Faz 2.1).
  const matches = [...css.matchAll(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  return matches[matches.length - 1]?.[1] ?? '';
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
