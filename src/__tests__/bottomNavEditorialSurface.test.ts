import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/components/hava81/AtlasBottomNav.css', 'utf8');
const component = readFileSync('src/components/hava81/AtlasBottomNav.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
}

describe('mobile bottom navigation editorial surface', () => {
  it('uses a flat paper surface instead of blur and shadow decoration', () => {
    const surface = rule('.atlas-bottom-nav');

    expect(surface).toContain('background: var(--bottom-nav-paper)');
    expect(surface).not.toContain('box-shadow');
    expect(surface).not.toContain('backdrop-filter');
  });

  it('keeps the active state focused on color, weight and the existing underline', () => {
    const active = rule('.atlas-bottom-nav__button--active');

    expect(active).toContain('color: var(--bottom-nav-accent)');
    expect(active).toContain('background: transparent');
    expect(css).toContain('.atlas-bottom-nav__button--active::after');
    expect(css).not.toContain('.atlas-bottom-nav__button--active .atlas-bottom-nav__icon');
  });

  it('describes the selected single-page destination as the current location', () => {
    expect(component).toContain("aria-current={isActive ? 'location' : undefined}");
    expect(component).not.toContain("aria-current={isActive ? 'page' : undefined}");
    expect(css).toContain(".atlas-bottom-nav__button[aria-current='location']");
    expect(app).toContain("aria-current={activeNav === 'compare' ? 'location' : undefined}");
    expect(app).not.toContain("aria-current={activeNav === 'compare' ? 'page' : undefined}");
  });

  it('names the saved-city destination for the comparison it actually opens', () => {
    expect(component).toContain("label: t('hava81.compare.action')");
    expect(component).toContain('function CompareIcon()');
    expect(component).toContain('icon: <CompareIcon />');
    expect(component).not.toContain('function SavedIcon()');
    expect(component).not.toContain("label: t('navigation.saved'");
    expect(app).toContain("if (item === 'compare')");
    expect(app).toContain("<ComparePanel cities={favorites}");
  });

  it('does not offer an unusable map destination before weather exists', () => {
    expect(component).toContain("const isDisabled = item.value === 'map' && !canMap;");
    expect(component).toContain('disabled={isDisabled}');
    expect(app).toContain('{weather || favorites.length > 0 ? (');
    expect(app).toContain('canMap={Boolean(weather)}');
    expect(css).toContain('.atlas-bottom-nav__button:disabled');
  });
});
